-- Platform admin functions and audit triggers for partner company listings.

-- Update audit_row to support composite key on listing_courses (listing_id:course_id).
create or replace function audit_row() returns trigger
language plpgsql as $$
declare
  hidden text[] := array['clerk_id', 'clerk_invitation_id', 'updated_at'];
  old_j jsonb;
  new_j jsonb;
  diff_old jsonb;
  diff_new jsonb;
  src jsonb;
  v_actor uuid;
  v_row text;
begin
  begin
    v_actor := nullif(current_setting('app.actor', true), '')::uuid;
  exception
    when invalid_text_representation then
      v_actor := null;
  end;
  -- a person creating their own account is the actor of that insert
  if v_actor is null and TG_TABLE_NAME = 'users' and TG_OP = 'INSERT' then
    v_actor := new.id;
  end if;

  if TG_OP in ('UPDATE', 'DELETE') then
    old_j := to_jsonb(old) - hidden;
  end if;
  if TG_OP in ('INSERT', 'UPDATE') then
    new_j := to_jsonb(new) - hidden;
  end if;

  src := to_jsonb(case when TG_OP = 'DELETE' then old else new end);
  v_row := case TG_TABLE_NAME
    when 'coordinator_assignments' then (src ->> 'user_id') || ':' || (src ->> 'course_id')
    when 'supervisor_memberships' then src ->> 'user_id'
    when 'listing_courses' then (src ->> 'listing_id') || ':' || (src ->> 'course_id')
    else src ->> 'id'
  end;

  if TG_OP = 'UPDATE' then
    select jsonb_object_agg(key, old_j -> key), jsonb_object_agg(key, new_j -> key)
      into diff_old, diff_new
    from jsonb_object_keys(new_j) as key
    where old_j -> key is distinct from new_j -> key;
    if diff_new is null then
      return new;
    end if;
    old_j := diff_old;
    new_j := diff_new;
  end if;

  insert into audit_log (table_name, row_id, action, old_value, new_value, actor_id, source)
  values (
    TG_TABLE_NAME,
    v_row,
    lower(TG_OP),
    old_j,
    new_j,
    v_actor,
    case when v_actor is null then 'database' else 'app' end
  );
  return coalesce(new, old);
end;
$$;

-- Triggers to log changes to listings and their target courses.
create trigger audit_listings
  after insert or update or delete on listings
  for each row execute function audit_row();

create trigger audit_listing_courses
  after insert or update or delete on listing_courses
  for each row execute function audit_row();

-- Creates a new listing for a partner company, targeting one or more courses.
create function create_listing(
  p_actor uuid,
  p_company_id uuid,
  p_title text,
  p_description text,
  p_course_ids uuid[]
) returns uuid
language plpgsql as $$
declare
  v_listing_id uuid;
begin
  perform require_admin(p_actor);

  if not exists (select 1 from companies where id = p_company_id and status = 'active') then
    raise exception 'invalid: company does not exist or is inactive';
  end if;

  if length(trim(coalesce(p_title, ''))) = 0 then
    raise exception 'invalid: title cannot be blank';
  end if;

  if p_course_ids is null or cardinality(p_course_ids) = 0 then
    raise exception 'invalid: a listing must be open to at least one course';
  end if;

  if (select count(distinct id) from courses where id = any(p_course_ids)) <> cardinality(p_course_ids) then
    raise exception 'invalid: one or more course ids do not exist';
  end if;

  insert into listings (company_id, title, description, status, created_by)
  values (p_company_id, trim(p_title), nullif(trim(p_description), ''), 'open', p_actor)
  returning id into v_listing_id;

  insert into listing_courses (listing_id, course_id)
  select v_listing_id, unnest(p_course_ids);

  return v_listing_id;
end;
$$;

-- Updates a listing's title, description, and target courses.
create function update_listing(
  p_actor uuid,
  p_listing_id uuid,
  p_title text,
  p_description text,
  p_course_ids uuid[]
) returns void
language plpgsql as $$
begin
  perform require_admin(p_actor);

  if not exists (select 1 from listings where id = p_listing_id) then
    raise exception 'not_found: listing not found';
  end if;

  if length(trim(coalesce(p_title, ''))) = 0 then
    raise exception 'invalid: title cannot be blank';
  end if;

  if p_course_ids is null or cardinality(p_course_ids) = 0 then
    raise exception 'invalid: a listing must be open to at least one course';
  end if;

  if (select count(distinct id) from courses where id = any(p_course_ids)) <> cardinality(p_course_ids) then
    raise exception 'invalid: one or more course ids do not exist';
  end if;

  update listings
  set title = trim(p_title),
      description = nullif(trim(p_description), '')
  where id = p_listing_id;

  delete from listing_courses
  where listing_id = p_listing_id
    and course_id <> all(p_course_ids);

  insert into listing_courses (listing_id, course_id)
  select p_listing_id, c_id
  from unnest(p_course_ids) as c_id
  on conflict (listing_id, course_id) do nothing;
end;
$$;

-- Sets a listing's status (open or closed).
create function set_listing_status(
  p_actor uuid,
  p_listing_id uuid,
  p_status listing_status
) returns void
language plpgsql as $$
begin
  perform require_admin(p_actor);

  if not exists (select 1 from listings where id = p_listing_id) then
    raise exception 'not_found: listing not found';
  end if;

  update listings
  set status = p_status
  where id = p_listing_id;
end;
$$;

revoke execute on function create_listing(uuid, uuid, text, text, uuid[]) from anon, authenticated;
grant execute on function create_listing(uuid, uuid, text, text, uuid[]) to service_role;

revoke execute on function update_listing(uuid, uuid, text, text, uuid[]) from anon, authenticated;
grant execute on function update_listing(uuid, uuid, text, text, uuid[]) to service_role;

revoke execute on function set_listing_status(uuid, uuid, listing_status) from anon, authenticated;
grant execute on function set_listing_status(uuid, uuid, listing_status) to service_role;
