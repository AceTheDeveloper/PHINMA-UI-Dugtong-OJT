-- Migration 11: keep the deployment_hours view off the API.
--
-- Migration 10 created the view as its owner with default grants, so any
-- signed-in user could read every student's approved hours and skip RLS.
-- security_invoker applies the caller's RLS; the revoke keeps it off the API
-- (same as listings_without_courses). Server code reads it with the
-- service-role key after its own role and ownership check.

alter view deployment_hours set (security_invoker = true);

revoke all on deployment_hours from anon, authenticated;
