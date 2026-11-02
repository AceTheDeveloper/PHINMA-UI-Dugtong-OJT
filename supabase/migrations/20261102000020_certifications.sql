-- Migration 20: certification. Submitting an evaluation (migration 19) now also
-- makes the student's certification: a record that keeps the facts as they were
-- at that moment, from which the PDF is drawn. A later change to the student,
-- the company, or the template never changes an issued certification. The text
-- of a certificate is data per course (certificate_templates), not code.
-- Errors start with a code word (forbidden, not_found, conflict, invalid) as in
-- migration 4.

-- One template per course. The body uses the placeholders {student},
-- {student_number}, {course}, {company}, {hours}, {start} and {end}.
create table certificate_templates (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null unique references courses(id),
  heading text not null default 'Certificate of completion'
    check (length(trim(heading)) between 1 and 100),
  body text not null default 'This is to certify that {student} ({student_number}) of {course} has completed {hours} hours of on-the-job training at {company} from {start} to {end}.'
    check (length(trim(body)) between 1 and 1000),
  -- Placeholders until the school names the real signatories.
  signatory_1_name text not null default 'Person 1' check (length(trim(signatory_1_name)) between 1 and 100),
  signatory_1_title text not null default 'Signatory' check (length(trim(signatory_1_title)) between 1 and 100),
  signatory_2_name text not null default 'Person 2' check (length(trim(signatory_2_name)) between 1 and 100),
  signatory_2_title text not null default 'Signatory' check (length(trim(signatory_2_title)) between 1 and 100),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table certificate_templates enable row level security;

create trigger certificate_templates_updated_at before update on certificate_templates
  for each row execute function set_updated_at();
create trigger audit_certificate_templates
  after insert or update or delete on certificate_templates
  for each row execute function audit_row();

-- Every course has a template: existing courses now, new courses as they appear.
insert into certificate_templates (course_id) select id from courses;

create function create_certificate_template() returns trigger
language plpgsql as $$
begin
  insert into certificate_templates (course_id) values (new.id);
  return new;
end;
$$;

create trigger courses_certificate_template
  after insert on courses
  for each row execute function create_certificate_template();

-- The coordinator of the course names the signatories.
create function save_certificate_template(
  p_actor uuid,
  p_course_id uuid,
  p_signatory_1_name text,
  p_signatory_1_title text,
  p_signatory_2_name text,
  p_signatory_2_title text
) returns void
language plpgsql as $$
declare
  v_values text[] := array[
    trim(coalesce(p_signatory_1_name, '')),
    trim(coalesce(p_signatory_1_title, '')),
    trim(coalesce(p_signatory_2_name, '')),
    trim(coalesce(p_signatory_2_title, ''))
  ];
  v_value text;
begin
  perform require_course_coordinator(p_actor, p_course_id);
  foreach v_value in array v_values loop
    if length(v_value) = 0 then
      raise exception 'invalid: each signatory needs a name and a title';
    end if;
    if length(v_value) > 100 then
      raise exception 'invalid: a name or title can be up to 100 characters';
    end if;
  end loop;

  update certificate_templates
  set signatory_1_name = v_values[1],
      signatory_1_title = v_values[2],
      signatory_2_name = v_values[3],
      signatory_2_title = v_values[4],
      updated_by = p_actor
  where course_id = p_course_id;
  if not found then
    raise exception 'not_found: certificate template not found';
  end if;
end;
$$;

create type certification_status as enum ('issued', 'voided');

-- A certification is a snapshot: every fact on the certificate is stored here.
create table certifications (
  id uuid primary key default gen_random_uuid(),
  -- Set to null when an admin reopens the evaluation; the snapshot stays.
  evaluation_id uuid references evaluations(id) on delete set null,
  deployment_id uuid not null references deployments(id) on delete restrict,
  student_id uuid not null references students(id),
  course_id uuid not null references courses(id),
  status certification_status not null default 'issued',
  student_name text not null,
  student_number text not null,
  course_name text not null,
  company_name text not null,
  supervisor_name text not null,
  issuer_name text not null,
  approved_hours numeric(8, 2) not null,
  required_hours numeric(6, 2) not null,
  start_date date not null,
  end_date date not null,
  heading text not null,
  body text not null,
  signatory_1_name text not null,
  signatory_1_title text not null,
  signatory_2_name text not null,
  signatory_2_title text not null,
  issued_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references users(id),
  void_reason text,
  constraint certifications_void_complete check (
    (status = 'issued' and voided_at is null and void_reason is null)
    or (status = 'voided' and voided_at is not null and void_reason is not null)
  )
);

-- One issued certification per deployment. Voided ones are kept as history.
create unique index certifications_one_issued_per_deployment
  on certifications(deployment_id) where status = 'issued';

alter table certifications enable row level security;

create trigger audit_certifications
  after insert or update or delete on certifications
  for each row execute function audit_row();

-- An issued certification can only become voided (with who, when, and why), or
-- lose its link to a reopened evaluation. Nothing else changes, and nothing is
-- deleted.
create function protect_certification() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'forbidden: a certification cannot be deleted';
  end if;
  if to_jsonb(new) - 'evaluation_id' - 'status' - 'voided_at' - 'voided_by' - 'void_reason'
     is distinct from
     to_jsonb(old) - 'evaluation_id' - 'status' - 'voided_at' - 'voided_by' - 'void_reason' then
    raise exception 'forbidden: an issued certification cannot be changed';
  end if;
  if new.status is distinct from old.status then
    if not (old.status = 'issued' and new.status = 'voided') then
      raise exception 'forbidden: a voided certification cannot be changed';
    end if;
  elsif old.status = 'voided' and (
    new.voided_at is distinct from old.voided_at
    or new.voided_by is distinct from old.voided_by
    or new.void_reason is distinct from old.void_reason
  ) then
    raise exception 'forbidden: a voided certification cannot be changed';
  end if;
  if new.evaluation_id is distinct from old.evaluation_id and new.evaluation_id is not null then
    raise exception 'forbidden: an issued certification cannot be changed';
  end if;
  return new;
end;
$$;

create trigger certifications_protect
  before update or delete on certifications
  for each row execute function protect_certification();

-- Migration 19 locked an evaluation completely. The admin support reopen is the
-- one way out: it sets this flag inside its own transaction to delete it.
create or replace function protect_evaluation() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' and current_setting('app.reopening_evaluation', true) = 'true' then
    return old;
  end if;
  raise exception 'forbidden: a submitted evaluation cannot be changed or deleted';
end;
$$;

-- Migration 19's submit_evaluation, now also making the certification in the
-- same transaction.
create or replace function submit_evaluation(
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

  -- The certification: every fact as it is now, and the template text as it is now.
  insert into certifications (
    evaluation_id, deployment_id, student_id, course_id,
    student_name, student_number, course_name, company_name, supervisor_name, issuer_name,
    approved_hours, required_hours, start_date, end_date,
    heading, body, signatory_1_name, signatory_1_title, signatory_2_name, signatory_2_title
  )
  select v_eval, dep.id, stu.id, c.id,
         stu.full_name, stu.student_number, c.name, co.name, sup.full_name,
         coalesce(
           (select u.full_name
            from coordinator_assignments a
            join users u on u.id = a.user_id and u.is_active
            where a.course_id = c.id
            order by a.created_at, a.user_id
            limit 1),
           'OJT coordinator'
         ),
         ev.approved_hours, ev.required_hours,
         coalesce((select min(l.log_date) from daily_logs l
                   where l.deployment_id = dep.id and l.status = 'approved'), school_today()),
         coalesce((select max(l.log_date) from daily_logs l
                   where l.deployment_id = dep.id and l.status = 'approved'), school_today()),
         t.heading, t.body, t.signatory_1_name, t.signatory_1_title,
         t.signatory_2_name, t.signatory_2_title
  from courses c
  join companies co on co.id = dep.company_id
  join users sup on sup.id = p_actor
  join evaluations ev on ev.id = v_eval
  join certificate_templates t on t.course_id = c.id
  where c.id = stu.course_id;
  if not found then
    raise exception 'conflict: the certificate template for this course is missing';
  end if;

  return v_eval;
end;
$$;

-- The admin support reopen of a submitted evaluation, for a mistake. It voids
-- the certification (the snapshot stays as history), removes the evaluation and
-- its scores (the audit log keeps what they were), and returns the deployment to
-- active so the supervisor can submit a corrected evaluation. The student's
-- hours and entries are not touched.
create function admin_reopen_evaluation(p_actor uuid, p_evaluation_id uuid, p_reason text) returns void
language plpgsql as $$
declare
  ev evaluations%rowtype;
  dep deployments%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  perform require_admin(p_actor);
  if v_reason = '' then
    raise exception 'invalid: give a reason for reopening the evaluation';
  end if;
  if length(v_reason) > 500 then
    raise exception 'invalid: the reason is too long';
  end if;

  select * into ev from evaluations where id = p_evaluation_id for update;
  if not found then
    raise exception 'not_found: evaluation not found';
  end if;
  select * into dep from deployments where id = ev.deployment_id for update;
  if exists (
    select 1 from deployments d
    where d.student_id = dep.student_id and d.status = 'active' and d.id <> dep.id
  ) then
    raise exception 'conflict: this student already has another active deployment';
  end if;

  perform set_config('app.reopening_evaluation', 'true', true);

  update certifications
  set status = 'voided', voided_at = now(), voided_by = p_actor, void_reason = v_reason
  where evaluation_id = ev.id and status = 'issued';

  delete from evaluation_scores where evaluation_id = ev.id;
  delete from evaluations where id = ev.id;
  update deployments set status = 'active', updated_at = now() where id = dep.id;
end;
$$;

revoke execute on function create_certificate_template() from public, anon, authenticated;
revoke execute on function save_certificate_template(uuid, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function save_certificate_template(uuid, uuid, text, text, text, text) to service_role;
revoke execute on function admin_reopen_evaluation(uuid, uuid, text) from public, anon, authenticated;
grant execute on function admin_reopen_evaluation(uuid, uuid, text) to service_role;
