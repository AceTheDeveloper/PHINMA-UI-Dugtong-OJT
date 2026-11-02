-- Deployments, daily logs, hours calculation, and admin reopen support action.

create type deployment_status as enum ('active', 'completed', 'ended');

create table deployments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  company_id uuid not null references companies(id),
  listing_id uuid references listings(id),
  ojt_batch_id uuid not null references ojt_batches(id),
  status deployment_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one active deployment per student at a time (AGENTS.md section 6).
create unique index deployments_one_active_per_student
  on deployments(student_id)
  where status = 'active';

alter table deployments enable row level security;

create type daily_log_status as enum ('open', 'pending', 'approved', 'rejected');

create table daily_logs (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references deployments(id) on delete restrict,
  log_date date not null,
  time_in timestamptz not null,
  time_out timestamptz,
  break_minutes integer not null default 0 check (break_minutes >= 0),
  location text,
  journal text,
  status daily_log_status not null default 'open',
  reject_reason text,
  reopen_reason text,
  reopened_by uuid references users(id),
  reopened_at timestamptz,
  approved_by uuid references users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_logs_one_per_day unique (deployment_id, log_date),
  constraint daily_logs_time_order check (time_out is null or time_out >= time_in)
);

alter table daily_logs enable row level security;

-- Audit triggers
create trigger audit_deployments
  after insert or update or delete on deployments
  for each row execute function audit_row();

create trigger audit_daily_logs
  after insert or update or delete on daily_logs
  for each row execute function audit_row();

-- Approved entries are locked. Only authorized reopen actions may modify them.
create or replace function protect_approved_daily_log()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and old.status = 'approved' then
    raise exception 'forbidden: approved daily log entries cannot be deleted'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and old.status = 'approved' then
    if current_setting('app.reopening_log', true) = 'true' then
      return new;
    end if;
    raise exception 'forbidden: approved daily log entries are locked'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger protect_approved_daily_log_trigger
  before update or delete on daily_logs
  for each row execute function protect_approved_daily_log();

-- Approved hours view per deployment
create or replace view deployment_hours as
select
  d.id as deployment_id,
  d.student_id,
  d.company_id,
  d.ojt_batch_id,
  d.status as deployment_status,
  coalesce(
    round(
      (sum(
        greatest(
          0,
          (extract(epoch from (dl.time_out - dl.time_in)) / 60) - dl.break_minutes
        )
      ) / 60.0)::numeric,
      2
    ),
    0.00
  ) as approved_hours,
  count(dl.id)::int as approved_entries_count
from deployments d
left join daily_logs dl
  on dl.deployment_id = d.id
 and dl.status = 'approved'
 and dl.time_out is not null
group by d.id;

-- Admin support reopen action: unlocks an approved entry back to pending
create or replace function admin_reopen_daily_log(
  p_actor uuid,
  p_log_id uuid,
  p_reason text
) returns void language plpgsql security definer as $$
declare
  v_status daily_log_status;
begin
  perform require_admin(p_actor);

  if p_reason is null or trim(p_reason) = '' then
    raise exception 'invalid: support reason is required to reopen an entry'
      using errcode = '22023';
  end if;

  select status into v_status
  from daily_logs
  where id = p_log_id;

  if not found then
    raise exception 'not_found: daily log entry was not found'
      using errcode = 'P0002';
  end if;

  if v_status <> 'approved' then
    raise exception 'invalid: only approved daily log entries can be reopened'
      using errcode = '22023';
  end if;

  perform set_config('app.actor', p_actor::text, true);
  perform set_config('app.reopening_log', 'true', true);

  update daily_logs
  set
    status = 'pending',
    reopen_reason = trim(p_reason),
    reopened_by = p_actor,
    reopened_at = now(),
    approved_by = null,
    approved_at = null,
    updated_at = now()
  where id = p_log_id;
end;
$$;

-- Helper to create deployment (used by admin and tests)
create or replace function create_deployment(
  p_actor uuid,
  p_student_id uuid,
  p_company_id uuid,
  p_listing_id uuid,
  p_batch_id uuid
) returns uuid language plpgsql security definer as $$
declare
  v_id uuid;
begin
  perform require_admin(p_actor);

  if not exists (select 1 from students where id = p_student_id) then
    raise exception 'not_found: student was not found'
      using errcode = 'P0002';
  end if;

  if not exists (select 1 from companies where id = p_company_id and status = 'active') then
    raise exception 'not_found: active company was not found'
      using errcode = 'P0002';
  end if;

  if not exists (select 1 from ojt_batches where id = p_batch_id) then
    raise exception 'not_found: ojt batch was not found'
      using errcode = 'P0002';
  end if;

  perform set_config('app.actor', p_actor::text, true);

  insert into deployments (student_id, company_id, listing_id, ojt_batch_id, status)
  values (p_student_id, p_company_id, p_listing_id, p_batch_id, 'active')
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function admin_reopen_daily_log(uuid, uuid, text) from public, anon, authenticated;
grant execute on function admin_reopen_daily_log(uuid, uuid, text) to service_role;

revoke execute on function create_deployment(uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function create_deployment(uuid, uuid, uuid, uuid, uuid) to service_role;
