-- Admin write functions and the audit log. Errors start with a code word
-- (forbidden, not_found, conflict, invalid) so server code can map them to
-- typed results, as in migration 4.

-- Audit log: one row per change, written by a trigger. Insert only.
-- row_id is text because some tables have a composite key.
create table audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  old_value jsonb,
  new_value jsonb,
  actor_id uuid references users (id),
  -- 'app' when a write function set the acting user, 'database' otherwise
  -- (for example an edit made in the SQL editor)
  source text not null check (source in ('app', 'database')),
  created_at timestamptz not null default now()
);

create index audit_log_created_at on audit_log (created_at desc, id desc);
create index audit_log_table_row on audit_log (table_name, row_id);
create index audit_log_actor on audit_log (actor_id);

create function forbid_audit_log_change() returns trigger
language plpgsql as $$
begin
  raise exception 'audit rows cannot be changed or deleted';
end;
$$;

create trigger audit_log_no_change
  before update or delete on audit_log
  for each row execute function forbid_audit_log_change();
create trigger audit_log_no_truncate
  before truncate on audit_log
  for each statement execute function forbid_audit_log_change();

revoke update, delete, truncate on audit_log
  from public, anon, authenticated, service_role;
alter table audit_log enable row level security;

-- One trigger function for every audited table. For an update only the
-- changed columns are stored, so the old and new values read as a diff.
-- Clerk ids and invitation ids are never stored.
create function audit_row() returns trigger
language plpgsql as $$
declare
  hidden text[] := array['clerk_id', 'clerk_invitation_id', 'updated_at'];
  old_j jsonb;
  new_j jsonb;
  diff_old jsonb;
  diff_new jsonb;
  src jsonb;
  v_actor uuid;
  v_row text;
begin
  begin
    v_actor := nullif(current_setting('app.actor', true), '')::uuid;
  exception
    when invalid_text_representation then
      v_actor := null;
  end;
  -- a person creating their own account is the actor of that insert
  if v_actor is null and TG_TABLE_NAME = 'users' and TG_OP = 'INSERT' then
    v_actor := new.id;
  end if;

  if TG_OP in ('UPDATE', 'DELETE') then
    old_j := to_jsonb(old) - hidden;
  end if;
  if TG_OP in ('INSERT', 'UPDATE') then
    new_j := to_jsonb(new) - hidden;
  end if;

  src := to_jsonb(case when TG_OP = 'DELETE' then old else new end);
  v_row := case TG_TABLE_NAME
    when 'coordinator_assignments' then (src ->> 'user_id') || ':' || (src ->> 'course_id')
    when 'supervisor_memberships' then src ->> 'user_id'
    else src ->> 'id'
  end;

  if TG_OP = 'UPDATE' then
    select jsonb_object_agg(key, old_j -> key), jsonb_object_agg(key, new_j -> key)
      into diff_old, diff_new
    from jsonb_object_keys(new_j) as key
    where old_j -> key is distinct from new_j -> key;
    if diff_new is null then
      return new;
    end if;
    old_j := diff_old;
    new_j := diff_new;
  end if;

  insert into audit_log (table_name, row_id, action, old_value, new_value, actor_id, source)
  values (
    TG_TABLE_NAME,
    v_row,
    lower(TG_OP),
    old_j,
    new_j,
    v_actor,
    case when v_actor is null then 'database' else 'app' end
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_departments after insert or update or delete on departments
  for each row execute function audit_row();
create trigger audit_courses after insert or update or delete on courses
  for each row execute function audit_row();
create trigger audit_ojt_batches after insert or update or delete on ojt_batches
  for each row execute function audit_row();
create trigger audit_companies after insert or update or delete on companies
  for each row execute function audit_row();
create trigger audit_supervisor_memberships
  after insert or update or delete on supervisor_memberships
  for each row execute function audit_row();
create trigger audit_coordinator_assignments
  after insert or update or delete on coordinator_assignments
  for each row execute function audit_row();
create trigger audit_invitations after insert or update or delete on invitations
  for each row execute function audit_row();
create trigger audit_students after insert or update or delete on students
  for each row execute function audit_row();
create trigger audit_users after insert or update or delete on users
  for each row execute function audit_row();

-- Sets the acting user and refuses anyone who is not an active admin.
create function require_admin(p_actor uuid) returns void
language plpgsql as $$
declare
  actor users%rowtype;
begin
  perform set_config('app.actor', p_actor::text, true);
  select * into actor from users where id = p_actor;
  if not found or not actor.is_active then
    raise exception 'forbidden: actor is not an active user';
  end if;
  if actor.role <> 'admin' then
    raise exception 'forbidden: only an admin can do this';
  end if;
end;
$$;

create function create_department(p_actor uuid, p_code text, p_name text)
returns uuid
language plpgsql as $$
declare
  v_id uuid;
begin
  perform require_admin(p_actor);
  begin
    insert into departments (code, name)
    values (upper(trim(p_code)), trim(p_name))
    returning id into v_id;
  exception
    when unique_violation then
      raise exception 'conflict: a department with this code already exists';
    when check_violation then
      raise exception 'invalid: code and name are required';
  end;
  return v_id;
end;
$$;

create function create_course(
  p_actor uuid,
  p_department_id uuid,
  p_code text,
  p_name text
) returns uuid
language plpgsql as $$
declare
  v_id uuid;
begin
  perform require_admin(p_actor);
  if not exists (
    select 1 from departments where id = p_department_id and is_active
  ) then
    raise exception 'not_found: department not found or inactive';
  end if;
  begin
    insert into courses (department_id, code, name)
    values (p_department_id, upper(trim(p_code)), trim(p_name))
    returning id into v_id;
  exception
    when unique_violation then
      raise exception 'conflict: this department already has a course with this code';
    when check_violation then
      raise exception 'invalid: code and name are required';
  end;
  return v_id;
end;
$$;

create function create_ojt_batch(
  p_actor uuid,
  p_course_id uuid,
  p_school_year text,
  p_required_hours numeric,
  p_starts_on date default null,
  p_ends_on date default null
) returns uuid
language plpgsql as $$
declare
  v_id uuid;
begin
  perform require_admin(p_actor);
  if not exists (select 1 from courses where id = p_course_id and is_active) then
    raise exception 'not_found: course not found or inactive';
  end if;
  begin
    insert into ojt_batches (course_id, school_year, required_hours, starts_on, ends_on)
    values (p_course_id, trim(p_school_year), p_required_hours, p_starts_on, p_ends_on)
    returning id into v_id;
  exception
    when unique_violation then
      raise exception 'conflict: this course already has a batch for this school year';
    when check_violation then
      raise exception 'invalid: check the school year (for example 2026-2027), the required hours, and the dates';
    when numeric_value_out_of_range then
      raise exception 'invalid: required hours is too large';
  end;
  return v_id;
end;
$$;

create function set_ojt_required_hours(
  p_actor uuid,
  p_batch_id uuid,
  p_required_hours numeric
) returns void
language plpgsql as $$
begin
  perform require_admin(p_actor);
  begin
    update ojt_batches set required_hours = p_required_hours where id = p_batch_id;
  exception
    when check_violation then
      raise exception 'invalid: required hours must be more than zero';
    when numeric_value_out_of_range then
      raise exception 'invalid: required hours is too large';
  end;
  if not found then
    raise exception 'not_found: batch not found';
  end if;
end;
$$;

create function create_company(p_actor uuid, p_name text, p_address text default null)
returns uuid
language plpgsql as $$
declare
  v_id uuid;
begin
  perform require_admin(p_actor);
  begin
    insert into companies (name, address)
    values (trim(p_name), nullif(trim(p_address), ''))
    returning id into v_id;
  exception
    when unique_violation then
      raise exception 'conflict: a company with this name already exists';
    when check_violation then
      raise exception 'invalid: company name is required';
  end;
  return v_id;
end;
$$;

create function set_company_status(
  p_actor uuid,
  p_company_id uuid,
  p_status company_status
) returns void
language plpgsql as $$
begin
  perform require_admin(p_actor);
  update companies set status = p_status where id = p_company_id;
  if not found then
    raise exception 'not_found: company not found';
  end if;
end;
$$;

revoke all on function require_admin(uuid) from public, anon, authenticated;
revoke all on function create_department(uuid, text, text)
  from public, anon, authenticated;
revoke all on function create_course(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function create_ojt_batch(uuid, uuid, text, numeric, date, date)
  from public, anon, authenticated;
revoke all on function set_ojt_required_hours(uuid, uuid, numeric)
  from public, anon, authenticated;
revoke all on function create_company(uuid, text, text)
  from public, anon, authenticated;
revoke all on function set_company_status(uuid, uuid, company_status)
  from public, anon, authenticated;

grant execute on function require_admin(uuid) to service_role;
grant execute on function create_department(uuid, text, text) to service_role;
grant execute on function create_course(uuid, uuid, text, text) to service_role;
grant execute on function create_ojt_batch(uuid, uuid, text, numeric, date, date)
  to service_role;
grant execute on function set_ojt_required_hours(uuid, uuid, numeric) to service_role;
grant execute on function create_company(uuid, text, text) to service_role;
grant execute on function set_company_status(uuid, uuid, company_status)
  to service_role;
