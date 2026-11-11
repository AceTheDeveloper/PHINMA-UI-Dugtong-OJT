-- Migration 24: Clerk webhook synchronization (ticket-38)
--
-- When a user changes their primary email address in Clerk, clerk_sync_user_email
-- updates users.email where users.clerk_id matches.
-- When a user account is deleted in Clerk, clerk_deactivate_user sets users.is_active = false
-- where users.clerk_id matches, fulfilling AGENTS.md section 7:
-- "Deactivated accounts lose access immediately."
--
-- Both functions set app.actor to the user's id so the audit_users trigger
-- records the change and the actor in audit_log.
-- If the clerk_id is not found, both functions no-op without error.

create or replace function clerk_sync_user_email(
  p_clerk_id text,
  p_email text
) returns void
language plpgsql as $$
declare
  v_user users%rowtype;
  v_clean_email text := lower(trim(p_email));
begin
  if p_clerk_id is null or trim(p_clerk_id) = '' then
    raise exception 'invalid: clerk_id is required';
  end if;
  if v_clean_email is null or v_clean_email = '' then
    raise exception 'invalid: email is required';
  end if;

  select * into v_user from users where clerk_id = p_clerk_id for update;
  if not found then
    -- User does not exist in Dugtong; gracefully no-op.
    return;
  end if;

  if v_user.email is not distinct from v_clean_email then
    -- Email unchanged; no-op.
    return;
  end if;

  if exists (select 1 from users where lower(email) = v_clean_email and id <> v_user.id) then
    raise exception 'conflict: email is already taken by another user';
  end if;

  perform set_config('app.actor', v_user.id::text, true);

  update users
  set email = v_clean_email
  where id = v_user.id;
end;
$$;

create or replace function clerk_deactivate_user(
  p_clerk_id text
) returns void
language plpgsql as $$
declare
  v_user users%rowtype;
begin
  if p_clerk_id is null or trim(p_clerk_id) = '' then
    raise exception 'invalid: clerk_id is required';
  end if;

  select * into v_user from users where clerk_id = p_clerk_id for update;
  if not found then
    -- User does not exist in Dugtong; gracefully no-op.
    return;
  end if;

  if not v_user.is_active then
    -- Already inactive; no-op.
    return;
  end if;

  perform set_config('app.actor', v_user.id::text, true);

  update users
  set is_active = false
  where id = v_user.id;
end;
$$;

revoke all on function clerk_sync_user_email(text, text) from public, anon, authenticated;
revoke all on function clerk_deactivate_user(text) from public, anon, authenticated;
grant execute on function clerk_sync_user_email(text, text) to service_role;
grant execute on function clerk_deactivate_user(text) to service_role;
