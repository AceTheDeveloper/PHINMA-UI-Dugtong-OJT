-- Companies and listings, plus supervisor membership and invitations,
-- which both point at companies.

create type company_status as enum ('active', 'inactive');

-- School-wide list of partner companies, entered once.
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  address text,
  status company_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index companies_name_key on companies (lower(name));

-- A supervisor belongs to exactly one company (the user is the primary key).
create table supervisor_memberships (
  user_id uuid primary key references users (id),
  company_id uuid not null references companies (id),
  is_owner boolean not null default false,
  created_at timestamptz not null default now()
);

-- At most one owner per company.
create unique index supervisor_memberships_one_owner
  on supervisor_memberships (company_id) where is_owner;

create trigger supervisor_memberships_role
  before insert or update on supervisor_memberships
  for each row execute function enforce_user_role('user_id', 'supervisor');

create type invitation_status as enum ('pending', 'used', 'expired', 'revoked');

create table invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (length(trim(email)) > 0),
  role user_role not null,
  student_id uuid references students (id),
  company_id uuid references companies (id),
  token_hash text not null unique check (length(trim(token_hash)) > 0),
  status invitation_status not null default 'pending',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- a student invitation targets a student, a supervisor invitation a company
  check (
    (role = 'student' and student_id is not null and company_id is null)
    or (role = 'supervisor' and company_id is not null and student_id is null)
    or (role in ('coordinator', 'admin') and student_id is null and company_id is null)
  ),
  check ((status = 'used') = (used_at is not null))
);

create function enforce_invitation_status() returns trigger
language plpgsql as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if old.status = 'pending' and new.status in ('used', 'expired', 'revoked') then
    return new;
  end if;
  raise exception 'invitation status cannot change from % to %', old.status, new.status;
end;
$$;

create trigger invitations_status
  before update of status on invitations
  for each row execute function enforce_invitation_status();

create type listing_status as enum ('open', 'closed');

create table listings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id),
  title text not null check (length(trim(title)) > 0),
  description text,
  status listing_status not null default 'open',
  created_by uuid references users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Which courses a listing is open to. Students see only listings for their course.
create table listing_courses (
  listing_id uuid not null references listings (id) on delete cascade,
  course_id uuid not null references courses (id),
  primary key (listing_id, course_id)
);

-- Listings nobody can see yet; lets the server refuse to publish them.
-- security_invoker applies the caller's RLS; the revoke keeps it off the API.
create view listings_without_courses with (security_invoker = true) as
  select l.*
  from listings l
  where not exists (select 1 from listing_courses lc where lc.listing_id = l.id);

revoke all on listings_without_courses from anon, authenticated;

create trigger companies_updated_at before update on companies
  for each row execute function set_updated_at();
create trigger invitations_updated_at before update on invitations
  for each row execute function set_updated_at();
create trigger listings_updated_at before update on listings
  for each row execute function set_updated_at();

alter table companies enable row level security;
alter table supervisor_memberships enable row level security;
alter table invitations enable row level security;
alter table listings enable row level security;
alter table listing_courses enable row level security;
