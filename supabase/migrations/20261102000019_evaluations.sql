-- Migration 19: the supervisor's final evaluation. When a student's approved hours
-- reach the batch's required hours, the supervisor rates every criterion of the
-- published form from 1 to 5 and submits. Submitting is final: it completes the
-- deployment. The hours gate is enforced here, in the database. Errors start
-- with a code word (forbidden, not_found, conflict, invalid) as in migration 4.

create table evaluations (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null unique references deployments(id) on delete restrict,
  -- The exact form version the scores were given against.
  form_id uuid not null references evaluation_forms(id),
  submitted_by uuid not null references users(id),
  overall_comment text check (overall_comment is null or length(overall_comment) <= 2000),
  -- Hours at the moment of submission, kept so the record never changes silently.
  approved_hours numeric(8, 2) not null,
  required_hours numeric(6, 2) not null,
  submitted_at timestamptz not null default now()
);

create table evaluation_scores (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references evaluations(id) on delete restrict,
  criterion_id uuid not null references evaluation_criteria(id),
  score smallint not null check (score between 1 and 5),
  comment text check (comment is null or length(comment) <= 500),
  constraint evaluation_scores_one_per_criterion unique (evaluation_id, criterion_id)
);

alter table evaluations enable row level security;
alter table evaluation_scores enable row level security;

create trigger audit_evaluations
  after insert or update or delete on evaluations
  for each row execute function audit_row();
create trigger audit_evaluation_scores
  after insert or update or delete on evaluation_scores
  for each row execute function audit_row();

-- A submitted evaluation is final.
create function protect_evaluation() returns trigger
language plpgsql as $$
begin
  raise exception 'forbidden: a submitted evaluation cannot be changed or deleted';
end;
$$;

create trigger evaluations_protect
  before update or delete on evaluations
  for each row execute function protect_evaluation();
create trigger evaluation_scores_protect
  before update or delete on evaluation_scores
  for each row execute function protect_evaluation();

-- The gate: approved hours must be at least the batch's required hours. A
-- function so the message is the same wherever it is checked.
create function check_evaluation_hours(p_deployment_id uuid) returns void
language plpgsql as $$
declare
  v_hours numeric;
  v_required numeric;
begin
  select coalesce(h.approved_hours, 0), b.required_hours into v_hours, v_required
  from deployments d
  join ojt_batches b on b.id = d.ojt_batch_id
  left join deployment_hours h on h.deployment_id = d.id
  where d.id = p_deployment_id;
  if not found then
    raise exception 'not_found: student not found';
  end if;
  if v_hours < v_required then
    raise exception 'conflict: this student has % of % required hours. They can be evaluated once they reach the required hours',
      trim(to_char(v_hours, 'FM999990.00')), trim(to_char(v_required, 'FM999990.00'));
  end if;
end;
$$;

-- The same gate on every insert, so a direct insert cannot skip it.
create function evaluation_gate() returns trigger
language plpgsql as $$
begin
  perform check_evaluation_hours(new.deployment_id);
  return new;
end;
$$;

create trigger evaluations_gate
  before insert on evaluations
  for each row execute function evaluation_gate();

-- Submits the evaluation. p_scores is a JSON array of
-- {"criterion_id": uuid, "score": 1-5, "comment": text or null}, one per
-- criterion of the published form. Everything is checked before anything is
-- written, and the writes happen in this one transaction.
create function submit_evaluation(
  p_actor uuid,
  p_deployment_id uuid,
  p_scores jsonb,
  p_overall_comment text
) returns uuid
language plpgsql as $$
declare
  v_company uuid;
  dep deployments%rowtype;
  stu students%rowtype;
  frm evaluation_forms%rowtype;
  v_overall text := nullif(trim(coalesce(p_overall_comment, '')), '');
  v_criteria integer;
  v_seen uuid[] := '{}';
  v_criterion uuid;
  v_comment text;
  item jsonb;
  v_eval uuid;
begin
  perform set_config('app.actor', p_actor::text, true);
  v_company := supervisor_company_of(p_actor);

  select * into dep from deployments where id = p_deployment_id and company_id = v_company for update;
  if not found then
    raise exception 'not_found: student not found';
  end if;
  if exists (select 1 from evaluations where deployment_id = dep.id) then
    raise exception 'conflict: this student has already been evaluated';
  end if;
  if dep.status <> 'active' then
    raise exception 'conflict: only an active deployment can be evaluated';
  end if;

  select * into stu from students where id = dep.student_id;
  select * into frm from evaluation_forms where course_id = stu.course_id and status = 'published';
  if not found then
    raise exception 'conflict: your coordinator has not published the evaluation form yet';
  end if;

  perform check_evaluation_hours(dep.id);

  select count(*) into v_criteria from evaluation_criteria where form_id = frm.id;
  if p_scores is null or jsonb_typeof(p_scores) <> 'array' or jsonb_array_length(p_scores) <> v_criteria then
    raise exception 'invalid: rate every criterion of the form';
  end if;
  if v_overall is not null and length(v_overall) > 2000 then
    raise exception 'invalid: the overall comment is too long';
  end if;

  for item in select * from jsonb_array_elements(p_scores) loop
    if jsonb_typeof(item) <> 'object'
       or coalesce(item ->> 'criterion_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or coalesce(item ->> 'score', '') !~ '^[1-5]$' then
      raise exception 'invalid: each criterion needs a score from 1 to 5';
    end if;
    v_criterion := (item ->> 'criterion_id')::uuid;
    if not exists (select 1 from evaluation_criteria where id = v_criterion and form_id = frm.id) then
      raise exception 'invalid: a rating is for a criterion that is not on the form';
    end if;
    if v_criterion = any(v_seen) then
      raise exception 'invalid: a criterion is rated twice';
    end if;
    v_seen := v_seen || v_criterion;
    v_comment := nullif(trim(coalesce(item ->> 'comment', '')), '');
    if v_comment is not null and length(v_comment) > 500 then
      raise exception 'invalid: a comment is too long';
    end if;
  end loop;

  insert into evaluations (deployment_id, form_id, submitted_by, overall_comment, approved_hours, required_hours)
  select dep.id, frm.id, p_actor, v_overall,
         coalesce(h.approved_hours, 0), b.required_hours
  from ojt_batches b
  left join deployment_hours h on h.deployment_id = dep.id
  where b.id = dep.ojt_batch_id
  returning id into v_eval;

  insert into evaluation_scores (evaluation_id, criterion_id, score, comment)
  select v_eval, (e ->> 'criterion_id')::uuid, (e ->> 'score')::smallint,
         nullif(trim(coalesce(e ->> 'comment', '')), '')
  from jsonb_array_elements(p_scores) as e;

  update deployments set status = 'completed', updated_at = now() where id = dep.id;
  return v_eval;
end;
$$;

revoke execute on function check_evaluation_hours(uuid) from public, anon, authenticated;
grant execute on function check_evaluation_hours(uuid) to service_role;
revoke execute on function submit_evaluation(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function submit_evaluation(uuid, uuid, jsonb, text) to service_role;
