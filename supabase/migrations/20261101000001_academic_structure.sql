-- Academic structure: school settings, departments, courses, OJT batches.
-- Nothing here is specific to one department or course. The pilot department and course are seed data.

create function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- One row only: the boolean primary key must be true.
create table school_settings (
  id boolean primary key default true check (id),
  name text not null check (length(trim(name)) > 0),
  timezone text not null default 'Asia/Manila' check (length(trim(timezone)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into school_settings (name) values ('PHINMA University of Iloilo');

create table departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(trim(code)) > 0),
  name text not null check (length(trim(name)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table courses (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments (id),
  code text not null check (length(trim(code)) > 0),
  name text not null check (length(trim(name)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, code)
);

create type ojt_batch_status as enum ('planned', 'active', 'closed');

-- One course's OJT in one school year. Required hours and the per-course
-- settings live here, so a later change applies to the next batch only.
create table ojt_batches (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id),
  school_year text not null check (
    case
      when school_year ~ '^[0-9]{4}-[0-9]{4}$'
        then substr(school_year, 6)::int = substr(school_year, 1, 4)::int + 1
      else false
    end
  ),
  required_hours numeric(6, 2) not null check (required_hours > 0),
  stale_threshold_days integer not null default 3 check (stale_threshold_days >= 1),
  time_in_window_minutes integer not null default 30
    check (time_in_window_minutes between 0 and 240),
  starts_on date,
  ends_on date,
  status ojt_batch_status not null default 'planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, school_year),
  -- lets students point at (batch, course) so the two can never disagree
  unique (id, course_id),
  check (starts_on is null or ends_on is null or ends_on >= starts_on)
);

create function enforce_ojt_batch_status() returns trigger
language plpgsql as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if (old.status = 'planned' and new.status = 'active')
     or (old.status = 'active' and new.status = 'closed') then
    return new;
  end if;
  raise exception 'ojt batch status cannot change from % to %', old.status, new.status;
end;
$$;

create trigger ojt_batches_status
  before update of status on ojt_batches
  for each row execute function enforce_ojt_batch_status();

create trigger school_settings_updated_at before update on school_settings
  for each row execute function set_updated_at();
create trigger departments_updated_at before update on departments
  for each row execute function set_updated_at();
create trigger courses_updated_at before update on courses
  for each row execute function set_updated_at();
create trigger ojt_batches_updated_at before update on ojt_batches
  for each row execute function set_updated_at();

-- Users never write to tables directly. With RLS on and no policies, user
-- sessions can read and write nothing; server code uses the service role.
alter table school_settings enable row level security;
alter table departments enable row level security;
alter table courses enable row level security;
alter table ojt_batches enable row level security;
