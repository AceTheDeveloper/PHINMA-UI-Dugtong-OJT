-- Migration 16: the student side of the daily log. A student times in, writes
-- a journal, and times out; the entry then waits for the supervisor. Every
-- time is the database clock (now()), never one sent by the browser. Errors
-- start with a code word (forbidden, not_found, conflict, invalid) as in
-- migration 4.

-- The window before the scheduled start in which a student can time in is data.
alter table school_settings
  add column time_in_window_minutes integer not null default 30
  check (time_in_window_minutes between 0 and 240);

-- The schedule that applied when the student timed in, so a later schedule
-- change never rewrites an old entry. Null on entries made before this.
alter table daily_logs
  add column schedule_start time,
  add column schedule_end time,
  add column early_out_reason text;

-- A clock time on a school date, as a moment in time.
create function school_timestamp(p_date date, p_time time) returns timestamptz
language sql stable as $$
  select (p_date + p_time) at time zone (select timezone from school_settings limit 1)
$$;

-- Starts the day's entry. Needs an active deployment, a schedule in force, a
-- working day, and the time to be inside the window (from a little before the
-- start until the scheduled end). Returns the entry id.
create function time_in(p_actor uuid) returns uuid
language plpgsql as $$
declare
  stu students%rowtype;
  dep deployments%rowtype;
  sched work_schedules%rowtype;
  day work_schedule_days%rowtype;
  v_today date;
  v_window integer;
  v_opens timestamptz;
  v_ends timestamptz;
  v_id uuid;
begin
  perform set_config('app.actor', p_actor::text, true);
  stu := active_student_of(p_actor);

  select * into dep from deployments where student_id = stu.id and status = 'active';
  if not found then
    raise exception 'conflict: you do not have an active deployment';
  end if;

  v_today := school_today();

  select * into sched
  from work_schedules
  where deployment_id = dep.id and effective_from <= v_today
  order by effective_from desc
  limit 1;
  if not found then
    raise exception 'conflict: your supervisor has not set your work schedule yet';
  end if;

  select * into day
  from work_schedule_days
  where schedule_id = sched.id and weekday = extract(isodow from v_today)::int;
  if not found then
    raise exception 'conflict: today is not one of your working days';
  end if;

  if exists (select 1 from daily_logs where deployment_id = dep.id and log_date = v_today) then
    raise exception 'conflict: you already timed in today';
  end if;

  select time_in_window_minutes into v_window from school_settings;
  v_opens := school_timestamp(v_today, day.start_time) - make_interval(mins => v_window);
  v_ends := school_timestamp(
    v_today + case when day.end_time < day.start_time then 1 else 0 end,
    day.end_time
  );
  if now() < v_opens then
    raise exception 'conflict: you can time in from %',
      trim(to_char(day.start_time - make_interval(mins => v_window), 'HH12:MI AM'));
  end if;
  if now() > v_ends then
    raise exception 'conflict: your scheduled time today has already ended. Ask your supervisor';
  end if;

  begin
    insert into daily_logs (deployment_id, log_date, time_in, schedule_start, schedule_end)
    values (dep.id, v_today, now(), day.start_time, day.end_time)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'conflict: you already timed in today';
  end;
  return v_id;
end;
$$;

-- The student's own entry, locked for the change. Someone else's entry is
-- reported as not found.
create function own_daily_log(p_actor uuid, p_log_id uuid) returns daily_logs
language plpgsql as $$
declare
  stu students%rowtype;
  lg daily_logs%rowtype;
begin
  perform set_config('app.actor', p_actor::text, true);
  stu := active_student_of(p_actor);
  select l.* into lg
  from daily_logs l
  join deployments d on d.id = l.deployment_id
  where l.id = p_log_id and d.student_id = stu.id
  for update of l;
  if not found then
    raise exception 'not_found: entry not found';
  end if;
  return lg;
end;
$$;

-- Saves a draft of the journal while the entry is open or was rejected.
create function save_journal(p_actor uuid, p_log_id uuid, p_journal text) returns void
language plpgsql as $$
declare
  lg daily_logs%rowtype;
begin
  lg := own_daily_log(p_actor, p_log_id);
  if lg.status not in ('open', 'rejected') then
    raise exception 'conflict: this entry can no longer be edited';
  end if;
  if length(coalesce(p_journal, '')) > 4000 then
    raise exception 'invalid: the journal is too long';
  end if;
  update daily_logs
  set journal = nullif(trim(p_journal), ''), updated_at = now()
  where id = lg.id;
end;
$$;

-- Times out and submits the journal: open becomes pending. Before the
-- scheduled end the student gives a reason, kept as the early out reason.
create function time_out(
  p_actor uuid,
  p_log_id uuid,
  p_journal text,
  p_early_reason text
) returns void
language plpgsql as $$
declare
  lg daily_logs%rowtype;
  v_status deployment_status;
  v_ends timestamptz;
  v_reason text := nullif(trim(coalesce(p_early_reason, '')), '');
begin
  lg := own_daily_log(p_actor, p_log_id);
  if lg.status <> 'open' then
    raise exception 'conflict: this entry is not open';
  end if;
  select status into v_status from deployments where id = lg.deployment_id;
  if v_status <> 'active' then
    raise exception 'conflict: your deployment is no longer active';
  end if;

  if length(trim(coalesce(p_journal, ''))) = 0 then
    raise exception 'invalid: write a short journal before you time out';
  end if;
  if length(p_journal) > 4000 then
    raise exception 'invalid: the journal is too long';
  end if;

  if lg.schedule_end is not null then
    v_ends := school_timestamp(
      lg.log_date + case when lg.schedule_end < lg.schedule_start then 1 else 0 end,
      lg.schedule_end
    );
  end if;
  if v_ends is not null and now() < v_ends then
    if v_reason is null then
      raise exception 'invalid: give a reason for timing out before %',
        trim(to_char(lg.schedule_end, 'HH12:MI AM'));
    end if;
    if length(v_reason) > 500 then
      raise exception 'invalid: the reason is too long';
    end if;
  else
    v_reason := null;
  end if;

  update daily_logs
  set time_out = now(),
      journal = trim(p_journal),
      early_out_reason = v_reason,
      status = 'pending',
      updated_at = now()
  where id = lg.id;
end;
$$;

-- A rejected entry goes back to pending with the fixed journal. The supervisor
-- corrects times; the student only fixes the journal.
create function resubmit_log(p_actor uuid, p_log_id uuid, p_journal text) returns void
language plpgsql as $$
declare
  lg daily_logs%rowtype;
begin
  lg := own_daily_log(p_actor, p_log_id);
  if lg.status <> 'rejected' then
    raise exception 'conflict: only a rejected entry can be resubmitted';
  end if;
  if length(trim(coalesce(p_journal, ''))) = 0 then
    raise exception 'invalid: write a short journal before you resubmit';
  end if;
  if length(p_journal) > 4000 then
    raise exception 'invalid: the journal is too long';
  end if;
  update daily_logs
  set journal = trim(p_journal),
      status = 'pending',
      reject_reason = null,
      updated_at = now()
  where id = lg.id;
end;
$$;

revoke execute on function school_timestamp(date, time) from public, anon, authenticated;
grant execute on function school_timestamp(date, time) to service_role;
revoke execute on function time_in(uuid) from public, anon, authenticated;
grant execute on function time_in(uuid) to service_role;
revoke execute on function own_daily_log(uuid, uuid) from public, anon, authenticated;
grant execute on function own_daily_log(uuid, uuid) to service_role;
revoke execute on function save_journal(uuid, uuid, text) from public, anon, authenticated;
grant execute on function save_journal(uuid, uuid, text) to service_role;
revoke execute on function time_out(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function time_out(uuid, uuid, text, text) to service_role;
revoke execute on function resubmit_log(uuid, uuid, text) from public, anon, authenticated;
grant execute on function resubmit_log(uuid, uuid, text) to service_role;
