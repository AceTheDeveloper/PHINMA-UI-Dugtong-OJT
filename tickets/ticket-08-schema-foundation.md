# ticket-08: Schema foundation (testing spike, academic structure, people, companies)

- Type: feature
- Assignee: Arwin Clyde B. Simondac
- Status: in progress
- Mockup: not needed (no UI)
- AGENTS.md sections: 2 scope, 4 roles, 7 security and audit, 8 code rules, 14 tickets
- Plan: `plan.md`, "Plan: core schema (ticket-08)" (approved)

## What and why

First slice of the database from the approved core schema plan. It sets up how database rules are tested without Docker, then builds the first three migrations: academic structure, people and access, and companies and listings. These are the foundation every later ticket depends on. The remaining migrations (applications and deployments, daily logs, evaluation and certification, audit, RLS) are separate tickets.

## In scope

1. **PGlite spike.** Confirm PGlite (Postgres in WebAssembly) running inside Vitest can apply our SQL migrations, enforce constraints, run triggers, and enforce RLS with a stubbed `auth.jwt()`. If it cannot, stop and write the finding under Open questions; the fallback is a separate hosted Supabase test project (needs a human decision).
2. **Test harness.** A helper under `tests/db/` that applies every file in `supabase/migrations/` to a fresh PGlite database and stubs the Supabase-only functions used by our SQL.
3. **Migration 1, academic structure:** `school_settings` (single row, seeded), `departments`, `courses`, `ojt_batches`, with the enums and constraints from the plan.
4. **Migration 2, people and access:** `users`, `coordinator_assignments`, `students`, `consents`.
5. **Migration 3, companies and listings:** `companies`, `supervisor_memberships` (one company per supervisor, one owner per company), `invitations`, `listings`, `listing_courses`. Supervisor memberships and invitations moved here from migration 2 because both point at companies.
6. `supabase/seed.sql` for development data (PHINMA UI, CITE, BSIT, a 2026-2027 batch). Never applied to production.
7. Database tests for each guard rail added in these migrations.
8. RLS enabled on every new table, with no insert, update, or delete policies for user sessions. Select policies come with the RLS ticket; until then user sessions can read nothing.

## Out of scope

- Applications, deployments, work schedules, daily logs, evaluations, certification, audit log and triggers, RLS select policies (later tickets).
- Clerk integration and `requireRole` (auth ticket).
- Any UI, and replacing the dashboard mock data.
- Writing to the hosted Supabase project; the human links and pushes it.

## Acceptance criteria

- [x] The PGlite spike result is recorded (works, or the blocker and fallback).
- [x] `npm run test` applies all migrations to a fresh database and the db tests pass.
- [x] `school_settings` cannot hold more than one row.
- [x] A course cannot have two batches with the same school year.
- [x] A company cannot have two owners; a supervisor cannot belong to two companies.
- [x] A student number is unique within a batch; a student email is unique.
- [x] A listing can be linked to several courses, and a listing with no course link is detectable.
- [x] RLS is enabled on every new table, and a session role with no policies cannot read or write them.
- [x] No CITE or BSIT value is hard-coded in a migration other than seed data.
- [x] Typecheck, lint, and tests pass.

## Test checklist

Tested by AI (tick only after actually running it, and note the command and result):

- [x] Typecheck, lint and tests pass (`npm run test`: 5 files, 50 tests passed; `npx tsc --noEmit` clean; `npm run lint` clean)
- [x] Each acceptance criterion has a test (`tests/db/`)

Tested by a human:

- [ ] Applied the migrations to the hosted dev project with `supabase db push` and checked the tables in the dashboard

## Plan (link to the plan in plan.md; plan first for any new feature)

See `plan.md`, "Plan: core schema (ticket-08)", migrations 1 to 3 and "Testing".

- [x] Plan approved by a human (approved by the developer in session)

## Open questions (AI writes here instead of guessing)

- None blocking. Open school questions are in `to-confirm.md`.

Spike result: PGlite works. Inside Vitest it applied the SQL migrations, enforced constraints and triggers, enforced RLS by role (`anon`, `authenticated`), let a `bypassrls` service role through, and accepted a stubbed `auth.jwt()`. Booting one in-memory database per test file takes several seconds, so `hookTimeout` is 60 s in `vitest.config.mts`.

Known limit: PGlite is not hosted Supabase, so a human still applies the migrations with `supabase db push` and checks the tables (human box below). "Exactly one owner per company" is enforced as at most one owner; a company with no owner yet is allowed, and the "first supervisor is the owner" rule belongs to the invite function in the admin ticket.

## Suggested AGENTS.md changes (a human applies these)

- None.

## Suggested new tickets (ideas found along the way, not built)

- ticket-09: applications, deployments, work schedules (migration 4).
- ticket-10: daily logs, hours view, and the write functions (migration 5).
- ticket-11: evaluation forms, evaluations, certification (migration 6).
- ticket-12: audit log, triggers, and the actor mechanism (migration 7).
- ticket-13: RLS select policies (migration 8) with an access test per permission row.
- Auth ticket: Clerk, invitation-only sign-up, `requireRole`, and the Clerk and Supabase connection.
