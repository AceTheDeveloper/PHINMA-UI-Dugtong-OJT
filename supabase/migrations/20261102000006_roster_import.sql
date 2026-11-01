-- Roster import: one function that adds every student of a file or none.
-- The server validates the file first for a friendly preview; this function
-- checks the rules again, so a bad file can never half-import. Errors start
-- with a code word (forbidden, not_found, conflict, invalid) as in migration 4.

create function import_roster(
  p_actor uuid,
  p_batch_id uuid,
  p_rows jsonb
) returns integer
language plpgsql as $$
declare
  actor users%rowtype;
  batch ojt_batches%rowtype;
  v_problems text[] := '{}';
  v_total integer;
  v_inserted integer;
  r record;
begin
  perform set_config('app.actor', p_actor::text, true);
  select * into actor from users where id = p_actor;
  if not found or not actor.is_active then
    raise exception 'forbidden: actor is not an active user';
  end if;
  if actor.role not in ('admin', 'coordinator') then
    raise exception 'forbidden: only a coordinator or an admin can import a roster';
  end if;

  -- lock the batch so two imports into it cannot interleave
  select * into batch from ojt_batches where id = p_batch_id for update;
  if not found then
    raise exception 'not_found: OJT batch not found';
  end if;
  if actor.role = 'coordinator' and not exists (
    select 1 from coordinator_assignments a
    where a.user_id = actor.id and a.course_id = batch.course_id
  ) then
    raise exception 'forbidden: this batch is not in one of your courses';
  end if;
  if batch.status = 'closed' then
    raise exception 'conflict: this OJT batch is closed';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'invalid: the roster has no rows';
  end if;
  v_total := jsonb_array_length(p_rows);
  if v_total > 1000 then
    raise exception 'invalid: a roster can have at most 1000 rows';
  end if;

  for r in
    with parsed as (
      select
        coalesce(
          case when jsonb_typeof(e.value -> 'row') = 'number' then (e.value ->> 'row')::int end,
          e.ordinality::int + 1
        ) as row_no,
        nullif(trim(case when jsonb_typeof(e.value) = 'object' then e.value ->> 'full_name' end), '') as full_name,
        nullif(trim(case when jsonb_typeof(e.value) = 'object' then e.value ->> 'student_number' end), '') as student_number,
        nullif(lower(trim(case when jsonb_typeof(e.value) = 'object' then e.value ->> 'email' end)), '') as email
      from jsonb_array_elements(p_rows) with ordinality as e(value, ordinality)
    )
    select
      p.*,
      min(p.row_no) over (partition by lower(p.student_number)) as first_number_row,
      min(p.row_no) over (partition by p.email) as first_email_row,
      exists (
        select 1 from students s
        where s.ojt_batch_id = p_batch_id
          and lower(s.student_number) = lower(p.student_number)
      ) as number_taken,
      (select s.course_id from students s where lower(s.email) = p.email limit 1) as email_course,
      exists (select 1 from users u where lower(u.email) = p.email) as email_has_account
    from parsed p
    order by p.row_no
  loop
    if r.full_name is null then
      v_problems := v_problems || format('row %s: full name is required', r.row_no);
    elsif length(r.full_name) > 120 then
      v_problems := v_problems || format('row %s: full name is longer than 120 characters', r.row_no);
    end if;

    if r.student_number is null then
      v_problems := v_problems || format('row %s: student number is required', r.row_no);
    elsif length(r.student_number) > 40 then
      v_problems := v_problems || format('row %s: student number is longer than 40 characters', r.row_no);
    elsif r.first_number_row < r.row_no then
      v_problems := v_problems || format('row %s: student number repeats row %s', r.row_no, r.first_number_row);
    elsif r.number_taken then
      v_problems := v_problems || format('row %s: student number is already in this batch', r.row_no);
    end if;

    if r.email is null then
      v_problems := v_problems || format('row %s: email is required', r.row_no);
    elsif r.email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      v_problems := v_problems || format('row %s: email is not valid', r.row_no);
    elsif r.first_email_row < r.row_no then
      v_problems := v_problems || format('row %s: email repeats row %s', r.row_no, r.first_email_row);
    elsif r.email_course is not null and r.email_course <> batch.course_id then
      v_problems := v_problems || format('row %s: email belongs to a student in another course', r.row_no);
    elsif r.email_course is not null then
      v_problems := v_problems || format('row %s: email is already on the roster', r.row_no);
    elsif r.email_has_account then
      v_problems := v_problems || format('row %s: an account already uses this email', r.row_no);
    end if;
  end loop;

  if array_length(v_problems, 1) is not null then
    raise exception '%',
      'conflict: ' || array_to_string(v_problems[1:10], '; ') ||
      case when array_length(v_problems, 1) > 10
        then format(' (and %s more)', array_length(v_problems, 1) - 10)
        else ''
      end;
  end if;

  begin
    insert into students (course_id, ojt_batch_id, student_number, email, full_name)
    select
      batch.course_id,
      p_batch_id,
      trim(e.value ->> 'student_number'),
      lower(trim(e.value ->> 'email')),
      trim(e.value ->> 'full_name')
    from jsonb_array_elements(p_rows) as e(value);
    get diagnostics v_inserted = row_count;
  exception
    when unique_violation then
      raise exception 'conflict: a student number or email in the file is already in use';
    when check_violation then
      raise exception 'invalid: the roster has a row with a blank value';
  end;

  return v_inserted;
end;
$$;

revoke all on function import_roster(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function import_roster(uuid, uuid, jsonb) to service_role;
