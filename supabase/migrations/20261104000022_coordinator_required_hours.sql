-- Migration 22: the coordinator may change the required hours of an OJT batch
-- in one of their own courses (AGENTS.md section 4, ticket-32). Replaces the
-- admin-only version from migration 5. The audit trigger on ojt_batches still
-- records the old value, the new value, who, and when. Errors start with a code
-- word (forbidden, not_found, conflict, invalid) as in migration 4.
--
-- A coordinator may set at most 2000 hours (plan.md, ticket-32). The admin keeps
-- the column's own limit, as before.

create or replace function set_ojt_required_hours(
  p_actor uuid,
  p_batch_id uuid,
  p_required_hours numeric
) returns void
language plpgsql as $$
declare
  actor users%rowtype;
  batch ojt_batches%rowtype;
begin
  perform set_config('app.actor', p_actor::text, true);
  select * into actor from users where id = p_actor;
  if not found or not actor.is_active then
    raise exception 'forbidden: actor is not an active user';
  end if;
  if actor.role not in ('admin', 'coordinator') then
    raise exception 'forbidden: only a coordinator or an admin can change required hours';
  end if;

  select * into batch from ojt_batches where id = p_batch_id for update;
  if not found then
    raise exception 'not_found: batch not found';
  end if;
  if actor.role = 'coordinator' then
    if not exists (
      select 1 from coordinator_assignments a
      where a.user_id = actor.id and a.course_id = batch.course_id
    ) then
      raise exception 'forbidden: this batch is not in one of your courses';
    end if;
    if p_required_hours > 2000 then
      raise exception 'invalid: required hours can be at most 2000';
    end if;
  end if;

  begin
    update ojt_batches set required_hours = p_required_hours where id = p_batch_id;
  exception
    when check_violation or not_null_violation then
      raise exception 'invalid: required hours must be more than zero';
    when numeric_value_out_of_range then
      raise exception 'invalid: required hours is too large';
  end;
end;
$$;

-- create or replace keeps the grants; they are repeated here so the access rule
-- is visible in this file.
revoke all on function set_ojt_required_hours(uuid, uuid, numeric)
  from public, anon, authenticated;
grant execute on function set_ojt_required_hours(uuid, uuid, numeric) to service_role;
