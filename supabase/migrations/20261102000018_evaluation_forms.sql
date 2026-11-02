-- Migration 18: the evaluation form. A coordinator builds, per course, a list of
-- criteria that supervisors rate from 1 to 5. A form is a draft until it is
-- published; a published form never changes, so a later change is a new version
-- and old evaluations always point at the exact form they used. Criteria are
-- data per course. Errors start with a code word (forbidden, not_found,
-- conflict, invalid) as in migration 4.

create type evaluation_form_status as enum ('draft', 'published', 'archived');

create table evaluation_forms (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id),
  version integer not null check (version > 0),
  status evaluation_form_status not null default 'draft',
  -- The scale is fixed for the pilot; the columns let a later course differ.
  scale_min smallint not null default 1 check (scale_min = 1),
  scale_max smallint not null default 5 check (scale_max = 5),
  created_by uuid not null references users(id),
  published_by uuid references users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evaluation_forms_one_version unique (course_id, version)
);

-- At most one draft and one published form per course.
create unique index evaluation_forms_one_draft
  on evaluation_forms(course_id) where status = 'draft';
create unique index evaluation_forms_one_published
  on evaluation_forms(course_id) where status = 'published';

create table evaluation_criteria (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references evaluation_forms(id) on delete cascade,
  position integer not null check (position > 0),
  label text not null check (length(trim(label)) between 1 and 200),
  constraint evaluation_criteria_one_position unique (form_id, position)
);

alter table evaluation_forms enable row level security;
alter table evaluation_criteria enable row level security;

create trigger evaluation_forms_updated_at before update on evaluation_forms
  for each row execute function set_updated_at();

-- Forms are audited. Criteria are not: a draft is rewritten whole on each save,
-- and a published form is immutable, so the form rows carry the history.
create trigger audit_evaluation_forms
  after insert or update or delete on evaluation_forms
  for each row execute function audit_row();

-- A published or archived form is locked. The only change allowed is a
-- published form becoming archived (when a newer version is published).
create function protect_evaluation_form() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'forbidden: a published form cannot be deleted';
    end if;
    return old;
  end if;

  if old.status = 'archived' then
    raise exception 'forbidden: an archived form cannot be changed';
  end if;
  if old.status = 'published' then
    if new.status = 'archived'
       and new.course_id = old.course_id
       and new.version = old.version
       and new.scale_min = old.scale_min
       and new.scale_max = old.scale_max
       and new.created_by = old.created_by
       and new.published_by is not distinct from old.published_by
       and new.published_at is not distinct from old.published_at then
      return new;
    end if;
    raise exception 'forbidden: a published form cannot be changed';
  end if;
  return new;
end;
$$;

create trigger evaluation_forms_protect
  before update or delete on evaluation_forms
  for each row execute function protect_evaluation_form();

-- Criteria can only change while their form is a draft.
create function protect_evaluation_criteria() returns trigger
language plpgsql as $$
declare
  v_status evaluation_form_status;
begin
  select status into v_status
  from evaluation_forms
  where id = case when tg_op = 'INSERT' then new.form_id else old.form_id end;
  -- The form is gone: its draft was deleted and the criteria go with it.
  if not found then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if v_status <> 'draft' then
    raise exception 'forbidden: the criteria of a published form cannot be changed';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger evaluation_criteria_protect
  before insert or update or delete on evaluation_criteria
  for each row execute function protect_evaluation_criteria();

-- The caller must be an active coordinator assigned to this course.
create function require_course_coordinator(p_actor uuid, p_course_id uuid) returns void
language plpgsql as $$
declare
  actor users%rowtype;
begin
  perform set_config('app.actor', p_actor::text, true);
  select * into actor from users where id = p_actor;
  if not found or not actor.is_active then
    raise exception 'forbidden: actor is not an active user';
  end if;
  if actor.role <> 'coordinator' or not exists (
    select 1 from coordinator_assignments a
    where a.user_id = actor.id and a.course_id = p_course_id
  ) then
    raise exception 'forbidden: only the coordinator of this course can change its evaluation form';
  end if;
end;
$$;

-- The form, locked for the change, when the caller coordinates its course. A form
-- that does not exist and a form of another course get the same answer for an
-- active coordinator ("not found"), so the answer does not reveal which exist.
-- Anyone who is not an active coordinator is refused.
create function coordinator_form(p_actor uuid, p_form_id uuid) returns evaluation_forms
language plpgsql as $$
declare
  frm evaluation_forms%rowtype;
begin
  perform set_config('app.actor', p_actor::text, true);
  select * into frm from evaluation_forms where id = p_form_id for update;
  if not found or not exists (
    select 1
    from coordinator_assignments a
    join users u on u.id = a.user_id
    where a.user_id = p_actor and a.course_id = frm.course_id
      and u.is_active and u.role = 'coordinator'
  ) then
    if exists (select 1 from users where id = p_actor and is_active and role = 'coordinator') then
      raise exception 'not_found: evaluation form not found';
    end if;
    raise exception 'forbidden: only the coordinator of this course can change its evaluation form';
  end if;
  return frm;
end;
$$;

-- Starts a new draft version for the course, as a copy of the newest form's
-- criteria so the coordinator edits instead of retyping.
create function create_evaluation_draft(p_actor uuid, p_course_id uuid) returns uuid
language plpgsql as $$
declare
  v_id uuid;
  v_version integer;
  v_source uuid;
begin
  perform require_course_coordinator(p_actor, p_course_id);
  if exists (select 1 from evaluation_forms where course_id = p_course_id and status = 'draft') then
    raise exception 'conflict: this course already has a draft. Open it to keep editing';
  end if;

  select coalesce(max(version), 0) + 1 into v_version
  from evaluation_forms where course_id = p_course_id;

  select id into v_source
  from evaluation_forms
  where course_id = p_course_id and status in ('published', 'archived')
  order by version desc
  limit 1;

  insert into evaluation_forms (course_id, version, created_by)
  values (p_course_id, v_version, p_actor)
  returning id into v_id;

  if v_source is not null then
    insert into evaluation_criteria (form_id, position, label)
    select v_id, position, label from evaluation_criteria where form_id = v_source;
  end if;
  return v_id;
end;
$$;

-- Replaces the draft's criteria with this list, in this order.
create function save_evaluation_draft(p_actor uuid, p_form_id uuid, p_criteria text[]) returns void
language plpgsql as $$
declare
  frm evaluation_forms%rowtype;
  v_labels text[];
begin
  frm := coordinator_form(p_actor, p_form_id);
  if frm.status <> 'draft' then
    raise exception 'conflict: only a draft can be edited. Start a new version instead';
  end if;
  if p_criteria is null or cardinality(p_criteria) > 30 then
    raise exception 'invalid: a form can have up to 30 criteria';
  end if;

  select coalesce(array_agg(trim(c) order by ord), '{}') into v_labels
  from unnest(p_criteria) with ordinality as t(c, ord);

  if exists (select 1 from unnest(v_labels) l where length(l) = 0) then
    raise exception 'invalid: a criterion cannot be empty';
  end if;
  if exists (select 1 from unnest(v_labels) l where length(l) > 200) then
    raise exception 'invalid: a criterion can be up to 200 characters';
  end if;
  if (select count(distinct lower(l)) from unnest(v_labels) l) <> cardinality(v_labels) then
    raise exception 'invalid: two criteria have the same name';
  end if;

  delete from evaluation_criteria where form_id = frm.id;
  insert into evaluation_criteria (form_id, position, label)
  select frm.id, ord, l from unnest(v_labels) with ordinality as t(l, ord);
  update evaluation_forms set updated_at = now() where id = frm.id;
end;
$$;

-- Publishes the draft: it becomes the form supervisors use, and the one it
-- replaces is archived. From here on it cannot change.
create function publish_evaluation_form(p_actor uuid, p_form_id uuid) returns void
language plpgsql as $$
declare
  frm evaluation_forms%rowtype;
begin
  frm := coordinator_form(p_actor, p_form_id);
  if frm.status <> 'draft' then
    raise exception 'conflict: only a draft can be published';
  end if;
  if not exists (select 1 from evaluation_criteria where form_id = frm.id) then
    raise exception 'invalid: add at least one criterion before you publish';
  end if;

  update evaluation_forms set status = 'archived'
  where course_id = frm.course_id and status = 'published';

  update evaluation_forms
  set status = 'published', published_by = p_actor, published_at = now()
  where id = frm.id;
end;
$$;

create function discard_evaluation_draft(p_actor uuid, p_form_id uuid) returns void
language plpgsql as $$
declare
  frm evaluation_forms%rowtype;
begin
  frm := coordinator_form(p_actor, p_form_id);
  if frm.status <> 'draft' then
    raise exception 'conflict: only a draft can be discarded';
  end if;
  delete from evaluation_forms where id = frm.id;
end;
$$;

revoke execute on function require_course_coordinator(uuid, uuid) from public, anon, authenticated;
grant execute on function require_course_coordinator(uuid, uuid) to service_role;
revoke execute on function coordinator_form(uuid, uuid) from public, anon, authenticated;
grant execute on function coordinator_form(uuid, uuid) to service_role;
revoke execute on function create_evaluation_draft(uuid, uuid) from public, anon, authenticated;
grant execute on function create_evaluation_draft(uuid, uuid) to service_role;
revoke execute on function save_evaluation_draft(uuid, uuid, text[]) from public, anon, authenticated;
grant execute on function save_evaluation_draft(uuid, uuid, text[]) to service_role;
revoke execute on function publish_evaluation_form(uuid, uuid) from public, anon, authenticated;
grant execute on function publish_evaluation_form(uuid, uuid) to service_role;
revoke execute on function discard_evaluation_draft(uuid, uuid) from public, anon, authenticated;
grant execute on function discard_evaluation_draft(uuid, uuid) to service_role;
