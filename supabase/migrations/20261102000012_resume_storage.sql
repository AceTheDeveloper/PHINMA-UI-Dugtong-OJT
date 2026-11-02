-- Migration 12: resume storage. One private bucket, one resume per student.
-- Files are written and read only by server code with the service-role key, so
-- the bucket gets no policies for anon or authenticated (row level security is
-- already on for storage.objects, so no policy means no access). Errors start
-- with a code word (forbidden, not_found, invalid) as in migration 4.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 2097152, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = 2097152,
      allowed_mime_types = array['application/pdf'];

-- The record of each student's current resume. The path is fixed, so a
-- replacement overwrites the old file.
create table resumes (
  student_id uuid primary key references students (id),
  storage_path text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 2097152),
  uploaded_at timestamptz not null default now(),
  check (storage_path = student_id::text || '/resume.pdf')
);

alter table resumes enable row level security;

-- Records that the student's own resume file was stored. Returns the path.
create function save_resume(p_actor uuid, p_size integer) returns text
language plpgsql as $$
declare
  actor users%rowtype;
  v_student uuid;
  v_path text;
begin
  select * into actor from users where id = p_actor;
  if not found or not actor.is_active then
    raise exception 'forbidden: actor is not an active user';
  end if;
  if actor.role <> 'student' then
    raise exception 'forbidden: only a student can upload a resume';
  end if;
  select id into v_student from students
    where user_id = actor.id and is_active;
  if not found then
    raise exception 'forbidden: no active student record for this account';
  end if;
  if p_size is null or p_size <= 0 or p_size > 2097152 then
    raise exception 'invalid: a resume must be larger than 0 bytes and at most 2 MB';
  end if;

  v_path := v_student::text || '/resume.pdf';
  insert into resumes (student_id, storage_path, size_bytes)
    values (v_student, v_path, p_size)
  on conflict (student_id) do update
    set size_bytes = excluded.size_bytes, uploaded_at = now();
  return v_path;
end;
$$;

-- The storage path the actor may read for a student's resume. Access is
-- checked first, so a caller who may not read it cannot tell if one exists.
-- Own resume: the student. Coordinator: students in their own course.
-- Admin: none. Supervisors of a company the student applied to are added with
-- the applications migration; until then supervisors get nothing.
create function resume_path_for(p_actor uuid, p_student_id uuid) returns text
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

revoke execute on function save_resume(uuid, integer) from public, anon, authenticated;
grant execute on function save_resume(uuid, integer) to service_role;
revoke execute on function resume_path_for(uuid, uuid) from public, anon, authenticated;
grant execute on function resume_path_for(uuid, uuid) to service_role;
