-- Authentication support: invitation changes and the write functions the
-- server calls through rpc. Errors start with a code word (forbidden,
-- not_found, conflict, invalid) so server code can map them to typed results.

alter table school_settings
  add column consent_notice_version text not null default 'v1'
  check (length(trim(consent_notice_version)) > 0);

-- Clerk issues the invitation token, so we no longer store one.
alter table invitations drop column token_hash;
alter table invitations
  add column clerk_invitation_id text unique
  check (length(trim(clerk_invitation_id)) > 0);
alter table invitations add column course_id uuid references courses (id);

-- Replace the old target check (it did not know about courses).
do $$
declare
  old_check text;
begin
  select conname into old_check
  from pg_constraint
  where conrelid = 'invitations'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%coordinator%';
  if old_check is not null then
    execute format('alter table invitations drop constraint %I', old_check);
  end if;
end;
$$;

alter table invitations add constraint invitations_target_check check (
  (role = 'student' and student_id is not null and company_id is null and course_id is null)
  or (role = 'supervisor' and company_id is not null and student_id is null and course_id is null)
  or (role = 'coordinator' and course_id is not null and student_id is null and company_id is null)
  or (role = 'admin' and student_id is null and company_id is null and course_id is null)
);

-- One open invitation per email; to resend, revoke the old one first.
create unique index invitations_one_pending_per_email
  on invitations (lower(email)) where status = 'pending';

-- Who may invite whom: admin anyone; a company owner supervisors of their own
-- company; a coordinator students of their own courses.
create function create_invitation(
  p_actor uuid,
  p_role user_role,
  p_email text,
  p_student_id uuid default null,
  p_company_id uuid default null,
  p_course_id uuid default null,
  p_expires_in_days integer default 7
) returns uuid
language plpgsql as $$
declare
  actor users%rowtype;
  v_email text := lower(trim(p_email));
  v_id uuid;
begin
  perform set_config('app.actor', p_actor::text, true);
  select * into actor from users where id = p_actor;
  if not found or not actor.is_active then
    raise exception 'forbidden: actor is not an active user';
  end if;
  if v_email is null or v_email = '' then
    raise exception 'invalid: email is required';
  end if;
  if p_expires_in_days < 1 or p_expires_in_days > 30 then
    raise exception 'invalid: expiry must be 1 to 30 days';
  end if;

  if actor.role = 'admin' then
    null;
  elsif actor.role = 'supervisor' then
    if p_role <> 'supervisor' or not exists (
      select 1 from supervisor_memberships m
      where m.user_id = actor.id and m.is_owner and m.company_id = p_company_id
    ) then
      raise exception 'forbidden: only a company owner can invite supervisors to their own company';
    end if;
  elsif actor.role = 'coordinator' then
    if p_role <> 'student' or not exists (
      select 1 from students s
      join coordinator_assignments a on a.course_id = s.course_id
      where s.id = p_student_id and a.user_id = actor.id
    ) then
      raise exception 'forbidden: a coordinator can only invite students of their own courses';
    end if;
  else
    raise exception 'forbidden: this role cannot invite';
  end if;

  if p_role = 'student' and exists (
    select 1 from students where id = p_student_id and user_id is not null
  ) then
    raise exception 'conflict: this student already has an account';
  end if;
  if p_role = 'supervisor' and not exists (
    select 1 from companies where id = p_company_id and status = 'active'
  ) then
    raise exception 'invalid: company not found or inactive';
  end if;

  begin
    insert into invitations
      (email, role, student_id, company_id, course_id, status, expires_at, created_by)
    values
      (v_email, p_role, p_student_id, p_company_id, p_course_id, 'pending',
       now() + make_interval(days => p_expires_in_days), actor.id)
    returning id into v_id;
  exception
    when unique_violation then
      raise exception 'conflict: a pending invitation already exists for this email';
    when check_violation then
      raise exception 'invalid: the invitation target does not match the role';
    when foreign_key_violation then
      raise exception 'invalid: invitation target not found';
  end;

  return v_id;
end;
$$;

-- Called once the server has created the Clerk invitation for this row.
create function set_invitation_clerk_id(
  p_actor uuid,
  p_invitation_id uuid,
  p_clerk_invitation_id text
) returns void
language plpgsql as $$
declare
  actor users%rowtype;
  inv invitations%rowtype;
begin
  perform set_config('app.actor', p_actor::text, true);
  select * into actor from users where id = p_actor;
  if not found or not actor.is_active then
    raise exception 'forbidden: actor is not an active user';
  end if;
  select * into inv from invitations where id = p_invitation_id for update;
  if not found then
    raise exception 'not_found: invitation not found';
  end if;
  if actor.role <> 'admin' and inv.created_by is distinct from actor.id then
    raise exception 'forbidden: only the sender or an admin can change this invitation';
  end if;
  if inv.clerk_invitation_id is not null then
    raise exception 'conflict: invitation already has a Clerk invitation';
  end if;
  update invitations set clerk_invitation_id = p_clerk_invitation_id where id = inv.id;
end;
$$;

create function revoke_invitation(p_actor uuid, p_invitation_id uuid) returns void
language plpgsql as $$
declare
  actor users%rowtype;
  inv invitations%rowtype;
begin
  perform set_config('app.actor', p_actor::text, true);
  select * into actor from users where id = p_actor;
  if not found or not actor.is_active then
    raise exception 'forbidden: actor is not an active user';
  end if;
  select * into inv from invitations where id = p_invitation_id for update;
  if not found then
    raise exception 'not_found: invitation not found';
  end if;
  if actor.role <> 'admin' and inv.created_by is distinct from actor.id then
    raise exception 'forbidden: only the sender or an admin can revoke this invitation';
  end if;
  if inv.status <> 'pending' then
    raise exception 'conflict: invitation is %', inv.status;
  end if;
  update invitations set status = 'revoked' where id = inv.id;
end;
$$;

-- Called on a person's first request after Clerk sign-up. Atomic and idempotent:
-- a second call for the same Clerk user returns the existing user.
create function accept_invitation(
  p_clerk_id text,
  p_email text,
  p_full_name text,
  p_invitation_id uuid
) returns uuid
language plpgsql as $$
declare
  inv invitations%rowtype;
  v_user uuid;
  v_email text := lower(trim(p_email));
  v_name text := nullif(trim(p_full_name), '');
begin
  if p_clerk_id is null or trim(p_clerk_id) = '' then
    raise exception 'invalid: clerk id is required';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_clerk_id));

  select id into v_user from users where clerk_id = p_clerk_id;
  if found then
    return v_user;
  end if;

  select * into inv from invitations where id = p_invitation_id for update;
  if not found then
    raise exception 'not_found: invitation not found';
  end if;
  if inv.status <> 'pending' then
    raise exception 'conflict: invitation is %', inv.status;
  end if;
  if inv.expires_at <= now() then
    raise exception 'conflict: invitation has expired';
  end if;
  if v_email is distinct from lower(trim(inv.email)) then
    raise exception 'forbidden: invitation was sent to a different email';
  end if;

  begin
    insert into users (clerk_id, email, full_name, role)
    values (p_clerk_id, v_email, coalesce(v_name, v_email), inv.role)
    returning id into v_user;
  exception
    when unique_violation then
      raise exception 'conflict: an account with this email already exists';
  end;
  perform set_config('app.actor', v_user::text, true);

  if inv.role = 'student' then
    update students set user_id = v_user
    where id = inv.student_id and user_id is null;
    if not found then
      raise exception 'conflict: student record is already linked';
    end if;
  elsif inv.role = 'supervisor' then
    if not exists (
      select 1 from companies where id = inv.company_id and status = 'active'
    ) then
      raise exception 'conflict: company is not active';
    end if;
    -- the first supervisor of a company becomes its owner
    insert into supervisor_memberships (user_id, company_id, is_owner)
    values (
      v_user,
      inv.company_id,
      not exists (
        select 1 from supervisor_memberships
        where company_id = inv.company_id and is_owner
      )
    );
  elsif inv.role = 'coordinator' then
    insert into coordinator_assignments (user_id, course_id)
    values (v_user, inv.course_id);
  end if;

  update invitations set status = 'used', used_at = now() where id = inv.id;
  return v_user;
end;
$$;

create function record_consent(p_user_id uuid, p_notice_version text) returns void
language plpgsql as $$
declare
  current_version text;
begin
  perform set_config('app.actor', p_user_id::text, true);
  if not exists (select 1 from users where id = p_user_id and is_active) then
    raise exception 'forbidden: user is not active';
  end if;
  select consent_notice_version into current_version from school_settings;
  if p_notice_version is distinct from current_version then
    raise exception 'conflict: notice version is out of date';
  end if;
  insert into consents (user_id, notice_version)
  values (p_user_id, p_notice_version)
  on conflict do nothing;
end;
$$;

-- Admin: any user. Company owner: supervisors of their company. Coordinator:
-- students of their courses. Nobody changes their own account, which also means
-- the last active admin can never be deactivated (an admin acts on another).
create function set_user_active(
  p_actor uuid,
  p_user_id uuid,
  p_active boolean
) returns void
language plpgsql as $$
declare
  actor users%rowtype;
  target users%rowtype;
begin
  perform set_config('app.actor', p_actor::text, true);
  select * into actor from users where id = p_actor;
  if not found or not actor.is_active then
    raise exception 'forbidden: actor is not an active user';
  end if;
  select * into target from users where id = p_user_id for update;
  if not found then
    raise exception 'not_found: user not found';
  end if;
  if actor.id = target.id then
    raise exception 'forbidden: you cannot change your own account';
  end if;

  if actor.role = 'admin' then
    null;
  elsif actor.role = 'supervisor' then
    if target.role <> 'supervisor' or not exists (
      select 1
      from supervisor_memberships owner_row
      join supervisor_memberships target_row
        on target_row.company_id = owner_row.company_id
      where owner_row.user_id = actor.id
        and owner_row.is_owner
        and target_row.user_id = target.id
    ) then
      raise exception 'forbidden: only a company owner can change a supervisor of their company';
    end if;
  elsif actor.role = 'coordinator' then
    if target.role <> 'student' or not exists (
      select 1 from students s
      join coordinator_assignments a on a.course_id = s.course_id
      where s.user_id = target.id and a.user_id = actor.id
    ) then
      raise exception 'forbidden: a coordinator can only change students of their own courses';
    end if;
  else
    raise exception 'forbidden: this role cannot change accounts';
  end if;

  update users set is_active = p_active where id = target.id;
end;
$$;

-- One query for the session: role, active state, and scope.
create function resolve_session(p_clerk_id text)
returns table (
  user_id uuid,
  role user_role,
  is_active boolean,
  student_id uuid,
  course_ids uuid[],
  company_id uuid,
  is_company_owner boolean
)
language sql stable as $$
  select
    u.id,
    u.role,
    u.is_active,
    (select s.id from students s where s.user_id = u.id),
    coalesce(
      case u.role
        when 'coordinator' then (
          select array_agg(a.course_id order by a.course_id)
          from coordinator_assignments a where a.user_id = u.id
        )
        when 'student' then (
          select array[s.course_id] from students s where s.user_id = u.id
        )
      end,
      '{}'::uuid[]
    ),
    (select m.company_id from supervisor_memberships m where m.user_id = u.id),
    coalesce(
      (select m.is_owner from supervisor_memberships m where m.user_id = u.id),
      false
    )
  from users u
  where u.clerk_id = p_clerk_id
$$;

-- Only the service role may call these; user sessions never write directly.
revoke all on function create_invitation(uuid, user_role, text, uuid, uuid, uuid, integer)
  from public, anon, authenticated;
revoke all on function set_invitation_clerk_id(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function revoke_invitation(uuid, uuid)
  from public, anon, authenticated;
revoke all on function accept_invitation(text, text, text, uuid)
  from public, anon, authenticated;
revoke all on function record_consent(uuid, text)
  from public, anon, authenticated;
revoke all on function set_user_active(uuid, uuid, boolean)
  from public, anon, authenticated;
revoke all on function resolve_session(text)
  from public, anon, authenticated;

grant execute on function create_invitation(uuid, user_role, text, uuid, uuid, uuid, integer)
  to service_role;
grant execute on function set_invitation_clerk_id(uuid, uuid, text) to service_role;
grant execute on function revoke_invitation(uuid, uuid) to service_role;
grant execute on function accept_invitation(text, text, text, uuid) to service_role;
grant execute on function record_consent(uuid, text) to service_role;
grant execute on function set_user_active(uuid, uuid, boolean) to service_role;
grant execute on function resolve_session(text) to service_role;
