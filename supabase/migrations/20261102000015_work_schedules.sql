-- Migration 15: work schedules. A supervisor sets the days and the start and
-- end times a student works at their company (school timezone). A schedule
-- applies from its effective date; the newest one that has started is in force.
-- Past schedules are never edited, so earlier days keep the schedule they had.
-- Weekdays follow ISO: 1 is Monday, 7 is Sunday. An end earlier than the start
-- means the shift ends the next day (night shift). Errors start with a code
-- word (forbidden, not_found, conflict, invalid) as in migration 4.

create table work_schedules (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references deployments(id) on delete restrict,
  effective_from date not null,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  constraint work_schedules_one_per_start unique (deployment_id, effective_from)
);

create table work_schedule_days (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references work_schedules(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  constraint work_schedule_days_one_per_weekday unique (schedule_id, weekday),
  constraint work_schedule_days_has_length check (start_time <> end_time)
);

alter table work_schedules enable row level security;
alter table work_schedule_days enable row level security;

create trigger audit_work_schedules
  after insert or update or delete on work_schedules
  for each row execute function audit_row();
create trigger audit_work_schedule_days
  after insert or update or delete on work_schedule_days
  for each row execute function audit_row();

-- Today's date in the school's timezone.
create function school_today() returns date
language sql stable as $$
  select (now() at time zone (select timezone from school_settings limit 1))::date
$$;

-- p_days is a JSON array of {"weekday": 1-7, "start": "HH:MM", "end": "HH:MM"}.
-- Setting a schedule for a date that already has one replaces it, but only
-- while that date has not passed.
create function set_work_schedule(
  p_actor uuid,
  p_deployment_id uuid,
  p_effective_from date,
  p_days jsonb
) returns uuid
language plpgsql as $$
declare
  v_company uuid;
  dep deployments%rowtype;
  v_schedule uuid;
  item jsonb;
  v_weekday int;
  v_start time;
  v_end time;
  v_seen int[] := '{}';
begin
  perform set_config('app.actor', p_actor::text, true);
  v_company := supervisor_company_of(p_actor);

  select * into dep from deployments where id = p_deployment_id and company_id = v_company;
  if not found then
    raise exception 'not_found: student not found';
  end if;
  if dep.status <> 'active' then
    raise exception 'conflict: only an active deployment has a schedule';
  end if;

  if p_effective_from is null then
    raise exception 'invalid: choose the date the schedule starts';
  end if;
  if p_effective_from < school_today() then
    raise exception 'invalid: the schedule cannot start in the past';
  end if;

  if p_days is null or jsonb_typeof(p_days) <> 'array'
     or jsonb_array_length(p_days) = 0 or jsonb_array_length(p_days) > 7 then
    raise exception 'invalid: choose at least one working day';
  end if;

  -- Validate every day before anything is written.
  for item in select * from jsonb_array_elements(p_days) loop
    if jsonb_typeof(item) <> 'object'
       or coalesce(item ->> 'weekday', '') !~ '^[1-7]$'
       or coalesce(item ->> 'start', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       or coalesce(item ->> 'end', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception 'invalid: each day needs a weekday, a start time, and an end time';
    end if;
    v_weekday := (item ->> 'weekday')::int;
    if v_weekday = any(v_seen) then
      raise exception 'invalid: a weekday appears twice';
    end if;
    v_seen := v_seen || v_weekday;
    if (item ->> 'start')::time = (item ->> 'end')::time then
      raise exception 'invalid: start and end time cannot be the same';
    end if;
  end loop;

  -- Replace a schedule that starts on the same date (it cannot be in the past).
  delete from work_schedules where deployment_id = dep.id and effective_from = p_effective_from;

  insert into work_schedules (deployment_id, effective_from, created_by)
  values (dep.id, p_effective_from, p_actor)
  returning id into v_schedule;

  for item in select * from jsonb_array_elements(p_days) loop
    v_weekday := (item ->> 'weekday')::int;
    v_start := (item ->> 'start')::time;
    v_end := (item ->> 'end')::time;
    insert into work_schedule_days (schedule_id, weekday, start_time, end_time)
    values (v_schedule, v_weekday, v_start, v_end);
  end loop;

  return v_schedule;
end;
$$;

revoke execute on function school_today() from public, anon, authenticated;
grant execute on function school_today() to service_role;
revoke execute on function set_work_schedule(uuid, uuid, date, jsonb) from public, anon, authenticated;
grant execute on function set_work_schedule(uuid, uuid, date, jsonb) to service_role;
