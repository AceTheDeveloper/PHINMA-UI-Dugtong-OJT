-- Migration 13: student applications to listings. Students apply and withdraw
-- through two functions only; accepting and rejecting come in a later ticket.
-- Errors start with a code word (forbidden, not_found, conflict, invalid) as in
-- migration 4.

create type application_status as enum ('applied', 'accepted', 'rejected', 'withdrawn');

create table applications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id),
  listing_id uuid not null references listings (id),
  status application_status not null default 'applied',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One application per student per listing. A withdrawn or rejected one is
  -- not reopened (working default, plan: ticket-15).
  unique (student_id, listing_id)
);

create index applications_listing_id on applications (listing_id);

create trigger applications_updated_at before update on applications
  for each row execute function set_updated_at();
create trigger audit_applications
  after insert or update or delete on applications
  for each row execute function audit_row();

alter table applications enable row level security;

-- The active student record behind a student account, or an error.
create function active_student_of(p_actor uuid) returns students
language plpgsql stable as $$
declare
  actor users%rowtype;
  stu students%rowtype;
begin
  select * into actor from users where id = p_actor;
  if not found or not actor.is_active then
    raise exception 'forbidden: actor is not an active user';
  end if;
  if actor.role <> 'student' then
    raise exception 'forbidden: only a student can do this';
  end if;
  select * into stu from students where user_id = actor.id and is_active;
  if not found then
    raise exception 'forbidden: no active student record for this account';
  end if;
  return stu;
end;
$$;

-- A student applies to an open listing of their own course. The resume must be
-- uploaded first. A listing that is closed, belongs to an inactive company, or
-- is not open to the student's course is reported as not found, so a student
-- cannot tell which listings exist for other courses.
create function apply_to_listing(p_actor uuid, p_listing_id uuid) returns uuid
language plpgsql as $$
declare
  stu students%rowtype;
  v_id uuid;
begin
  perform set_config('app.actor', p_actor::text, true);
  stu := active_student_of(p_actor);

  if not exists (
    select 1
    from listings l
    join companies c on c.id = l.company_id
    join listing_courses lc on lc.listing_id = l.id
    where l.id = p_listing_id
      and l.status = 'open'
      and c.status = 'active'
      and lc.course_id = stu.course_id
  ) then
    raise exception 'not_found: this listing is not available';
  end if;

  if not exists (select 1 from resumes where student_id = stu.id) then
    raise exception 'invalid: upload your resume before applying';
  end if;

  begin
    insert into applications (student_id, listing_id)
    values (stu.id, p_listing_id)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'conflict: you already applied to this listing';
  end;
  return v_id;
end;
$$;

-- A student withdraws their own application while it is still applied. Someone
-- else's application is reported as not found.
create function withdraw_application(p_actor uuid, p_application_id uuid) returns void
language plpgsql as $$
declare
  stu students%rowtype;
  app applications%rowtype;
begin
  perform set_config('app.actor', p_actor::text, true);
  stu := active_student_of(p_actor);

  select * into app from applications
    where id = p_application_id and student_id = stu.id
    for update;
  if not found then
    raise exception 'not_found: application not found';
  end if;
  if app.status <> 'applied' then
    raise exception 'conflict: only an application that is still applied can be withdrawn';
  end if;

  update applications set status = 'withdrawn' where id = app.id;
end;
$$;

-- Resume access, now with supervisors: a supervisor may read the resume of a
-- student who has a not-withdrawn application to a listing of their company.
-- (Replaces the migration 12 function; the other rules are unchanged.)
create or replace function resume_path_for(p_actor uuid, p_student_id uuid) returns text
language plpgsql stable as $$
declare
  actor users%rowtype;
  stu students%rowtype;
  v_allowed boolean := false;
  v_path text;
begin
  select * into actor from users where id = p_actor;
  if not found or not actor.is_active then
    raise exception 'forbidden: actor is not an active user';
  end if;
  select * into stu from students where id = p_student_id;
  if found then
    if actor.role = 'student' then
      v_allowed := stu.user_id = actor.id;
    elsif actor.role = 'coordinator' then
      v_allowed := exists (
        select 1 from coordinator_assignments a
        where a.user_id = actor.id and a.course_id = stu.course_id
      );
    elsif actor.role = 'supervisor' then
      v_allowed := exists (
        select 1
        from applications ap
        join listings l on l.id = ap.listing_id
        join supervisor_memberships m on m.company_id = l.company_id
        where ap.student_id = p_student_id
          and ap.status <> 'withdrawn'
          and m.user_id = actor.id
      );
    end if;
  end if;
  if not v_allowed then
    raise exception 'forbidden: you cannot view this resume';
  end if;

  select storage_path into v_path from resumes where student_id = p_student_id;
  if not found then
    raise exception 'not_found: this student has not uploaded a resume';
  end if;
  return v_path;
end;
$$;

revoke execute on function active_student_of(uuid) from public, anon, authenticated;
grant execute on function active_student_of(uuid) to service_role;
revoke execute on function apply_to_listing(uuid, uuid) from public, anon, authenticated;
grant execute on function apply_to_listing(uuid, uuid) to service_role;
revoke execute on function withdraw_application(uuid, uuid) from public, anon, authenticated;
grant execute on function withdraw_application(uuid, uuid) to service_role;
