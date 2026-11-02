-- Migration 21: reads for the coordinator dashboard. Both are read only and are
-- used by server code with the service-role key, after its own role and scope
-- check. They exist so the dashboard asks the database for totals instead of
-- pulling every daily log through the API (which caps a response at 1000 rows).

-- One row per deployment: the day of its latest entry, and how many of its
-- entries wait for the supervisor (pending) or were never timed out (open).
create view deployment_activity as
select
  d.id as deployment_id,
  d.student_id,
  d.company_id,
  d.ojt_batch_id,
  max(l.log_date) as last_entry_date,
  (count(l.id) filter (where l.status = 'pending'))::int as pending_entries,
  (count(l.id) filter (where l.status = 'open'))::int as open_entries
from deployments d
left join daily_logs l on l.deployment_id = d.id
group by d.id;

-- Same as deployment_hours (migration 11): the caller's RLS applies and the view
-- stays off the API.
alter view deployment_activity set (security_invoker = true);
revoke all on deployment_activity from anon, authenticated;

-- Approved hours of an OJT batch for each of the last p_weeks weeks (1 to 52),
-- oldest first, the current week last. A week starts on Monday in the school
-- timezone and a week with no approved hours is still listed, with 0. Only
-- approved entries count, with the break taken off, as in deployment_hours.
create function weekly_approved_hours(p_batch_id uuid, p_weeks integer)
returns table (week_start date, hours numeric)
language sql stable as $$
  with weeks as (
    select (date_trunc('week', school_today()::timestamp) - make_interval(weeks => g))::date as week_start
    from generate_series(0, greatest(least(coalesce(p_weeks, 8), 52), 1) - 1) as g
  )
  select
    w.week_start,
    coalesce(
      round(
        sum(greatest(0, extract(epoch from (l.time_out - l.time_in)) / 60 - l.break_minutes)) / 60.0,
        2
      ),
      0
    )::numeric as hours
  from weeks w
  left join (
    daily_logs l
    join deployments d on d.id = l.deployment_id and d.ojt_batch_id = p_batch_id
  )
    on l.status = 'approved'
   and l.time_out is not null
   and l.log_date >= w.week_start
   and l.log_date < w.week_start + 7
  group by w.week_start
  order by w.week_start
$$;

revoke execute on function weekly_approved_hours(uuid, integer) from public, anon, authenticated;
grant execute on function weekly_approved_hours(uuid, integer) to service_role;
