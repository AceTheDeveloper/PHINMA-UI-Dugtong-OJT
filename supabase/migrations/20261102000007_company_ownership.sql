-- Company ownership transfer by platform admin.
-- Atomically reassigns the owner supervisor for a partner company.

create function transfer_company_ownership(
  p_actor uuid,
  p_company_id uuid,
  p_new_owner_id uuid
) returns void
language plpgsql as $$
declare
  v_target users%rowtype;
  v_membership supervisor_memberships%rowtype;
begin
  perform require_admin(p_actor);

  if not exists (select 1 from companies where id = p_company_id and status = 'active') then
    raise exception 'not_found: company not found or inactive';
  end if;

  select * into v_target from users where id = p_new_owner_id;
  if not found or not v_target.is_active then
    raise exception 'forbidden: target supervisor is not an active user';
  end if;
  if v_target.role <> 'supervisor' then
    raise exception 'invalid: target user is not a supervisor';
  end if;

  select * into v_membership from supervisor_memberships
  where user_id = p_new_owner_id and company_id = p_company_id for update;

  if not found then
    raise exception 'invalid: supervisor does not belong to this company';
  end if;

  if v_membership.is_owner then
    return;
  end if;

  -- Atomically demote existing owner and promote new owner
  update supervisor_memberships
  set is_owner = false
  where company_id = p_company_id and is_owner;

  update supervisor_memberships
  set is_owner = true
  where user_id = p_new_owner_id and company_id = p_company_id;
end;
$$;

revoke all on function transfer_company_ownership(uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function transfer_company_ownership(uuid, uuid, uuid)
  to service_role;
