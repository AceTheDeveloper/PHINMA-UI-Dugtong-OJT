-- Migration 17: the supervisor side of the daily log. A supervisor approves,
-- rejects, or corrects the entries of their own company's students, reopens an
-- approved entry, and records a day the student worked but never timed in.
-- Errors start with a code word (forbidden, not_found, conflict, invalid) as in
-- migration 4. Every change is audited by the existing trigger; a correction
-- keeps the old values there.

alter table daily_logs
  add column correction_reason text,
  add column added_by uuid references users(id);

-- What a student sees when the supervisor recorded the day without a journal.
create function supervisor_recorded_note() returns text
language sql immutable as $$
  select 'Your supervisor recorded this day for you. Write your journal and resubmit.'
$$;

-- An entry of the supervisor's own company, locked for the change. An entry of
-- another company is reported as not found.
create function supervisor_log(p_actor uuid, p_log_id uuid) returns daily_logs
language plpgsql as $$
declare
  v_company uuid;
  lg daily_logs%rowtype;
begin
  perform set_config('app.actor', p_actor::text, true);
  v_company := supervisor_company_of(p_actor);
  select l.* into lg
  from daily_logs l
  join deployments d on d.id = l.deployment_id
  where l.id = p_log_id and d.company_id = v_company
  for update of l;
  if not found then
    raise exception 'not_found: entry not found';
  end if;
  return lg;
end;
$$;

create function approve_log(p_actor uuid, p_log_id uuid) returns void
language plpgsql as $$
declare
  lg daily_logs%rowtype;
begin
  lg := supervisor_log(p_actor, p_log_id);
  if lg.status <> 'pending' then
    raise exception 'conflict: only a pending entry can be approved';
  end if;
  if lg.time_out is null or length(trim(coalesce(lg.journal, ''))) = 0 then
    raise exception 'conflict: an entry needs a time out and a journal before it can be approved';
  end if;
  update daily_logs
  set status = 'approved', approved_by = p_actor, approved_at = now(), updated_at = now()
  where id = lg.id;
end;
$$;

-- Approves a chosen set in one transaction. If any entry is not pending, not
-- complete, or not the supervisor's, nothing changes.
create function bulk_approve_logs(p_actor uuid, p_log_ids uuid[]) returns integer
language plpgsql as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  if p_log_ids is null or cardinality(p_log_ids) = 0 or cardinality(p_log_ids) > 200 then
    raise exception 'invalid: choose between 1 and 200 entries';
  end if;
  for v_id in select distinct unnest(p_log_ids) loop
    perform approve_log(p_actor, v_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create function reject_log(p_actor uuid, p_log_id uuid, p_reason text) returns void
language plpgsql as $$
declare
  lg daily_logs%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  lg := supervisor_log(p_actor, p_log_id);
  if lg.status <> 'pending' then
    raise exception 'conflict: only a pending entry can be rejected';
  end if;
  if v_reason = '' then
    raise exception 'invalid: give a reason so the student knows what to fix';
  end if;
  if length(v_reason) > 500 then
    raise exception 'invalid: the reason is too long';
  end if;
  update daily_logs
  set status = 'rejected', reject_reason = v_reason, updated_at = now()
  where id = lg.id;
end;
$$;

-- Corrects the times and break of an entry (also how a forgotten time out is
-- set). Clock times are school time on the entry's own date; a time out earlier
-- than the time in means the shift ended the next day. An approved entry is
-- locked: reopen it first. An entry the student had not closed becomes pending,
-- or goes back to the student when it has no journal yet.
create function correct_log(
  p_actor uuid,
  p_log_id uuid,
  p_time_in time,
  p_time_out time,
  p_break_minutes integer,
  p_reason text
) returns void
language plpgsql as $$
declare
  lg daily_logs%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
  v_in timestamptz;
  v_out timestamptz;
  v_status daily_log_status;
  v_reject text;
begin
  lg := supervisor_log(p_actor, p_log_id);
  if lg.status = 'approved' then
    raise exception 'conflict: this entry is approved and locked. Reopen it first';
  end if;
  if p_time_in is null or p_time_out is null then
    raise exception 'invalid: give both the time in and the time out';
  end if;
  if v_reason = '' then
    raise exception 'invalid: give a reason for the correction';
  end if;
  if length(v_reason) > 500 then
    raise exception 'invalid: the reason is too long';
  end if;

  v_in := school_timestamp(lg.log_date, p_time_in);
  v_out := school_timestamp(lg.log_date + case when p_time_out < p_time_in then 1 else 0 end, p_time_out);
  if v_out <= v_in then
    raise exception 'invalid: the time out must be after the time in';
  end if;
  if p_break_minutes is null or p_break_minutes < 0
     or p_break_minutes > extract(epoch from (v_out - v_in)) / 60 then
    raise exception 'invalid: the break cannot be longer than the time worked';
  end if;

  v_status := lg.status;
  v_reject := lg.reject_reason;
  if lg.status = 'open' then
    if length(trim(coalesce(lg.journal, ''))) > 0 then
      v_status := 'pending';
    else
      v_status := 'rejected';
      v_reject := supervisor_recorded_note();
    end if;
  end if;

  update daily_logs
  set time_in = v_in,
      time_out = v_out,
      break_minutes = p_break_minutes,
      correction_reason = v_reason,
      status = v_status,
      reject_reason = v_reject,
      updated_at = now()
  where id = lg.id;
end;
$$;

-- Unlocks an approved entry: it goes back to pending so it can be corrected and
-- approved again. The reason is required and the reopening is audited.
create function reopen_log(p_actor uuid, p_log_id uuid, p_reason text) returns void
language plpgsql as $$
declare
  lg daily_logs%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  lg := supervisor_log(p_actor, p_log_id);
  if lg.status <> 'approved' then
    raise exception 'conflict: only an approved entry can be reopened';
  end if;
  if v_reason = '' then
    raise exception 'invalid: give a reason for reopening the entry';
  end if;
  if length(v_reason) > 500 then
    raise exception 'invalid: the reason is too long';
  end if;
  perform set_config('app.reopening_log', 'true', true);
  update daily_logs
  set status = 'pending',
      reopen_reason = v_reason,
      reopened_by = p_actor,
      reopened_at = now(),
      approved_by = null,
      approved_at = null,
      updated_at = now()
  where id = lg.id;
end;
$$;

-- Records a day the student worked but never timed in. Not in the future, not
-- before the deployment, and not a day that already has an entry. The student
-- then writes the journal and resubmits.
create function add_missed_day(
  p_actor uuid,
  p_deployment_id uuid,
  p_log_date date,
  p_time_in time,
  p_time_out time,
  p_break_minutes integer,
  p_reason text
) returns uuid
language plpgsql as $$
declare
  v_company uuid;
  dep deployments%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
  v_in timestamptz;
  v_out timestamptz;
  v_id uuid;
begin
  perform set_config('app.actor', p_actor::text, true);
  v_company := supervisor_company_of(p_actor);

  select * into dep from deployments where id = p_deployment_id and company_id = v_company;
  if not found then
    raise exception 'not_found: student not found';
  end if;
  if dep.status <> 'active' then
    raise exception 'conflict: only an active deployment can have a day added';
  end if;
  if p_log_date is null or p_time_in is null or p_time_out is null then
    raise exception 'invalid: give the date, the time in, and the time out';
  end if;
  if p_log_date > school_today() then
    raise exception 'invalid: a day in the future cannot be added';
  end if;
  if p_log_date < (dep.created_at at time zone (select timezone from school_settings limit 1))::date then
    raise exception 'invalid: that day is before the student was deployed';
  end if;
  if v_reason = '' then
    raise exception 'invalid: give a reason for adding the day';
  end if;
  if length(v_reason) > 500 then
    raise exception 'invalid: the reason is too long';
  end if;

  v_in := school_timestamp(p_log_date, p_time_in);
  v_out := school_timestamp(p_log_date + case when p_time_out < p_time_in then 1 else 0 end, p_time_out);
  if v_out <= v_in then
    raise exception 'invalid: the time out must be after the time in';
  end if;
  if p_break_minutes is null or p_break_minutes < 0
     or p_break_minutes > extract(epoch from (v_out - v_in)) / 60 then
    raise exception 'invalid: the break cannot be longer than the time worked';
  end if;

  begin
    insert into daily_logs (
      deployment_id, log_date, time_in, time_out, break_minutes,
      status, reject_reason, correction_reason, added_by
    ) values (
      dep.id, p_log_date, v_in, v_out, p_break_minutes,
      'rejected', supervisor_recorded_note(), v_reason, p_actor
    ) returning id into v_id;
  exception when unique_violation then
    raise exception 'conflict: that day already has an entry. Correct it instead';
  end;
  return v_id;
end;
$$;

revoke execute on function supervisor_recorded_note() from public, anon, authenticated;
grant execute on function supervisor_recorded_note() to service_role;
revoke execute on function supervisor_log(uuid, uuid) from public, anon, authenticated;
grant execute on function supervisor_log(uuid, uuid) to service_role;
revoke execute on function approve_log(uuid, uuid) from public, anon, authenticated;
grant execute on function approve_log(uuid, uuid) to service_role;
revoke execute on function bulk_approve_logs(uuid, uuid[]) from public, anon, authenticated;
grant execute on function bulk_approve_logs(uuid, uuid[]) to service_role;
revoke execute on function reject_log(uuid, uuid, text) from public, anon, authenticated;
grant execute on function reject_log(uuid, uuid, text) to service_role;
revoke execute on function correct_log(uuid, uuid, time, time, integer, text) from public, anon, authenticated;
grant execute on function correct_log(uuid, uuid, time, time, integer, text) to service_role;
revoke execute on function reopen_log(uuid, uuid, text) from public, anon, authenticated;
grant execute on function reopen_log(uuid, uuid, text) to service_role;
revoke execute on function add_missed_day(uuid, uuid, date, time, time, integer, text) from public, anon, authenticated;
grant execute on function add_missed_day(uuid, uuid, date, time, time, integer, text) to service_role;
