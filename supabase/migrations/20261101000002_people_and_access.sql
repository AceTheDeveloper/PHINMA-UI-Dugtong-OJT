-- People and access: users, coordinator assignments, students, consents.

create type user_role as enum ('admin', 'coordinator', 'supervisor', 'student');

create table users (
  id uuid primary key default gen_random_uuid(),
  clerk_id text not null unique check (length(trim(clerk_id)) > 0),
  email text not null check (length(trim(email)) > 0),
  full_name text not null check (length(trim(full_name)) > 0),
  role user_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index users_email_key on users (lower(email));

-- A user keeps the role they were created with.
create function forbid_user_role_change() returns trigger
language plpgsql as $$
begin
  if new.role is distinct from old.role then
    raise exception 'a user role cannot be changed';
  end if;
  return new;
end;
$$;

create trigger users_role_fixed
  before update of role on users
  for each row execute function forbid_user_role_change();

-- Checks that the user in the named column has the expected role.
-- Usage: execute function enforce_user_role('user_id', 'coordinator').
create function enforce_user_role() returns trigger
language plpgsql as $$
declare
  actual user_role;
  target uuid := nullif(to_jsonb(new) ->> TG_ARGV[0], '')::uuid;
begin
  if target is null then
    return new;
  end if;
  select role into actual from users where id = target;
  if actual is distinct from TG_ARGV[1]::user_role then
    raise exception 'user must have role %', TG_ARGV[1];
  end if;
  return new;
end;
$$;

-- Which courses a coordinator manages. One row in the pilot; more later is data.
create table coordinator_assignments (
  user_id uuid not null references users (id),
  course_id uuid not null references courses (id),
  created_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

create trigger coordinator_assignments_role
  before insert or update on coordinator_assignments
  for each row execute function enforce_user_role('user_id', 'coordinator');

-- Roster record. user_id stays null until the invitation is accepted.
create table students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references users (id),
  course_id uuid not null references courses (id),
  ojt_batch_id uuid not null,
  student_number text not null check (length(trim(student_number)) > 0),
  email text not null check (length(trim(email)) > 0),
  full_name text not null check (length(trim(full_name)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ojt_batch_id, student_number),
  foreign key (ojt_batch_id, course_id) references ojt_batches (id, course_id)
);

create unique index students_email_key on students (lower(email));

create trigger students_role
  before insert or update on students
  for each row execute function enforce_user_role('user_id', 'student');

-- Acceptance of the data privacy notice, per notice version.
create table consents (
  user_id uuid not null references users (id),
  notice_version text not null check (length(trim(notice_version)) > 0),
  accepted_at timestamptz not null default now(),
  primary key (user_id, notice_version)
);

create trigger users_updated_at before update on users
  for each row execute function set_updated_at();
create trigger students_updated_at before update on students
  for each row execute function set_updated_at();

alter table users enable row level security;
alter table coordinator_assignments enable row level security;
alter table students enable row level security;
alter table consents enable row level security;
