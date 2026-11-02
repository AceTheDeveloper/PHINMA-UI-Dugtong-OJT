-- Migration 14: supervisors manage their company's listings and decide on
-- applicants. Errors start with a code word (forbidden, not_found, conflict,
-- invalid) as in migration 4.

-- An admin, or a supervisor of this company, may manage its listings.
create function require_listing_manager(p_actor uuid, p_company_id uuid) returns void
language plpgsql as $$
declare
  actor users%rowtype;
begin
  perform set_config('app.actor', p_actor::text, true);
  select * into actor from users where id = p_actor;
  if not found or not actor.is_active then
    raise exception 'forbidden: actor is not an active user';
  end if;
  if actor.role = 'admin' then
    return;
  end if;
  if actor.role = 'supervisor' and exists (
    select 1 from supervisor_memberships m
    where m.user_id = actor.id and m.company_id = p_company_id
  ) then
    return;
  end if;
  raise exception 'forbidden: only an admin or a supervisor of this company can manage its listings';
end;
$$;

-- The three listing functions from migration 8, now open to the company's own
-- supervisors. Everything else in them is unchanged.
create or replace function create_listing(
  p_actor uuid,
  p_company_id uuid,
  p_title text,
  p_description text,
  p_course_ids uuid[]
) returns uuid
language plpgsql as $$
declare
  v_listing_id uuid;
begin
  perform require_listing_manager(p_actor, p_company_id);

  if not exists (select 1 from companies where id = p_company_id and status = 'active') then
    raise exception 'invalid: company does not exist or is inactive';
  end if;

  if length(trim(coalesce(p_title, ''))) = 0 then
    raise exception 'invalid: title cannot be blank';
  end if;

  if p_course_ids is null or cardinality(p_course_ids) = 0 then
    raise exception 'invalid: a listing must be open to at least one course';
  end if;

  if (select count(distinct id) from courses where id = any(p_course_ids)) <> cardinality(p_course_ids) then
    raise exception 'invalid: one or more course ids do not exist';
  end if;

  insert into listings (company_id, title, description, status, created_by)
  values (p_company_id, trim(p_title), nullif(trim(p_description), ''), 'open', p_actor)
  returning id into v_listing_id;

  insert into listing_courses (listing_id, course_id)
  select v_listing_id, unnest(p_course_ids);

  return v_listing_id;
end;
$$;

create or replace function update_listing(
  p_actor uuid,
  p_listing_id uuid,
  p_title text,
  p_description text,
  p_course_ids uuid[]
) returns void
language plpgsql as $$
declare
  v_company uuid;
begin
  select company_id into v_company from listings where id = p_listing_id;
  if not found then
    -- Still check the actor, so a stranger learns nothing from the answer.
    perform require_listing_manager(p_actor, '00000000-0000-0000-0000-000000000000');
    raise exception 'not_found: listing not found';
  end if;
  perform require_listing_manager(p_actor, v_company);

  if length(trim(coalesce(p_title, ''))) = 0 then
    raise exception 'invalid: title cannot be blank';
  end if;

  if p_course_ids is null or cardinality(p_course_ids) = 0 then
    raise exception 'invalid: a listing must be open to at least one course';
  end if;

  if (select count(distinct id) from courses where id = any(p_course_ids)) <> cardinality(p_course_ids) then
    raise exception 'invalid: one or more course ids do not exist';
  end if;

  update listings
  set title = trim(p_title),
      description = nullif(trim(p_description), '')
  where id = p_listing_id;

  delete from listing_courses
  where listing_id = p_listing_id
    and course_id <> all(p_course_ids);

  insert into listing_courses (listing_id, course_id)
  select p_listing_id, c_id
  from unnest(p_course_ids) as c_id
  on conflict (listing_id, course_id) do nothing;
end;
$$;

create or replace function set_listing_status(
  p_actor uuid,
  p_listing_id uuid,
  p_status listing_status
) returns void
language plpgsql as $$
declare
  v_company uuid;
begin
  select company_id into v_company from listings where id = p_listing_id;
  if not found then
    perform require_listing_manager(p_actor, '00000000-0000-0000-0000-000000000000');
    raise exception 'not_found: listing not found';
  end if;
  perform require_listing_manager(p_actor, v_company);

  update listings
  set status = p_status
  where id = p_listing_id;
end;
$$;

-- The company of an active supervisor, or an error. Used by the decisions below.
create function supervisor_company_of(p_actor uuid) returns uuid
language plpgsql stable as $$
declare
  actor users%rowtype;
  v_company uuid;
begin
  select * into actor from users where id = p_actor;
  if not found or not actor.is_active then
    raise exception 'forbidden: actor is not an active user';
  end if;
  if actor.role <> 'supervisor' then
    raise exception 'forbidden: only a supervisor can decide on applicants';
  end if;
  select company_id into v_company from supervisor_memberships where user_id = actor.id;
  if not found then
    raise exception 'forbidden: this supervisor has no company';
  end if;
  return v_company;
end;
$$;

-- Accepting is final. In one transaction: the application is accepted, the
-- student's active deployment is created, and the student's other open
-- applications are withdrawn. If any step fails nothing changes.
create function accept_application(p_actor uuid, p_application_id uuid) returns uuid
language plpgsql as $$
declare
  v_company uuid;
  app applications%rowtype;
  lst listings%rowtype;
  stu students%rowtype;
  v_deployment uuid;
begin
  perform set_config('app.actor', p_actor::text, true);
  v_company := supervisor_company_of(p_actor);

  select a.* into app
  from applications a
  join listings l on l.id = a.listing_id
  where a.id = p_application_id and l.company_id = v_company
  for update of a;
  if not found then
    raise exception 'not_found: application not found';
  end if;
  if app.status <> 'applied' then
    raise exception 'conflict: only an application that is still waiting can be accepted';
  end if;

  select * into lst from listings where id = app.listing_id;
  -- Lock the student so two acceptances for the same student cannot interleave.
  select * into stu from students where id = app.student_id for update;
  if not stu.is_active then
    raise exception 'conflict: this student is no longer active';
  end if;
  if exists (select 1 from deployments where student_id = stu.id and status = 'active') then
    raise exception 'conflict: this student already has an active deployment';
  end if;

  insert into deployments (student_id, company_id, listing_id, ojt_batch_id, status)
  values (stu.id, lst.company_id, lst.id, stu.ojt_batch_id, 'active')
  returning id into v_deployment;

  update applications set status = 'accepted' where id = app.id;

  update applications
  set status = 'withdrawn'
  where student_id = stu.id and id <> app.id and status = 'applied';

  return v_deployment;
end;
$$;

create function reject_application(p_actor uuid, p_application_id uuid) returns void
language plpgsql as $$
declare
  v_company uuid;
  app applications%rowtype;
begin
  perform set_config('app.actor', p_actor::text, true);
  v_company := supervisor_company_of(p_actor);

  select a.* into app
  from applications a
  join listings l on l.id = a.listing_id
  where a.id = p_application_id and l.company_id = v_company
  for update of a;
  if not found then
    raise exception 'not_found: application not found';
  end if;
  if app.status <> 'applied' then
    raise exception 'conflict: only an application that is still waiting can be rejected';
  end if;

  update applications set status = 'rejected' where id = app.id;
end;
$$;

revoke execute on function require_listing_manager(uuid, uuid) from public, anon, authenticated;
grant execute on function require_listing_manager(uuid, uuid) to service_role;
revoke execute on function supervisor_company_of(uuid) from public, anon, authenticated;
grant execute on function supervisor_company_of(uuid) to service_role;
revoke execute on function accept_application(uuid, uuid) from public, anon, authenticated;
grant execute on function accept_application(uuid, uuid) to service_role;
revoke execute on function reject_application(uuid, uuid) from public, anon, authenticated;
grant execute on function reject_application(uuid, uuid) to service_role;
