-- Migration 23: a company owner manages their company's supervisor invitations
-- (AGENTS.md section 4, ticket-33). Replaces two functions from migration 4;
-- migration 4 itself is not edited. Errors start with a code word (forbidden,
-- not_found, conflict, invalid) as in migration 4.
--
-- create_invitation, two new refusals for supervisor invitations:
--   - an email that already has a Dugtong account (one account, one role;
--     accepting would fail later anyway);
--   - an owner whose company already has 10 live pending invitations.
-- revoke_invitation: the owner of the invitation's company may revoke any
-- pending supervisor invitation to it, whoever sent it (plan.md, ticket-33).

create or replace function create_invitation(
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
  if p_role = 'supervisor' and exists (
    select 1 from users where lower(email) = v_email
  ) then
    raise exception 'conflict: this email already has a Dugtong account';
  end if;
  if actor.role = 'supervisor' then
    -- lock the company so two invitations cannot both pass the count
    perform 1 from companies where id = p_company_id for update;
    if (
      select count(*) from invitations
      where company_id = p_company_id and status = 'pending' and expires_at > now()
    ) >= 10 then
      raise exception 'conflict: this company already has 10 pending invitations';
    end if;
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

create or replace function revoke_invitation(p_actor uuid, p_invitation_id uuid) returns void
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
  if actor.role <> 'admin'
    and inv.created_by is distinct from actor.id
    and not (
      actor.role = 'supervisor'
      and inv.role = 'supervisor'
      and exists (
        select 1 from supervisor_memberships m
        where m.user_id = actor.id and m.is_owner and m.company_id = inv.company_id
      )
    )
  then
    raise exception 'forbidden: only the sender, the company owner, or an admin can revoke this invitation';
  end if;
  if inv.status <> 'pending' then
    raise exception 'conflict: invitation is %', inv.status;
  end if;
  update invitations set status = 'revoked' where id = inv.id;
end;
$$;

-- create or replace keeps the grants; they are repeated here so the access rule
-- is visible in this file.
revoke all on function create_invitation(uuid, user_role, text, uuid, uuid, uuid, integer)
  from public, anon, authenticated;
revoke all on function revoke_invitation(uuid, uuid) from public, anon, authenticated;
grant execute on function create_invitation(uuid, user_role, text, uuid, uuid, uuid, integer)
  to service_role;
grant execute on function revoke_invitation(uuid, uuid) to service_role;
