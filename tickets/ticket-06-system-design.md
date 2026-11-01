# ticket-06: System design (domain model, data, access layer, structure)

- Type: chore
- Assignee: Arwin Clyde B. Simondac
- Status: todo
- Mockup: not needed (no UI)
- AGENTS.md sections: 3 tech stack, 4 roles, 5 core flow, 6 business rules, 7 security and audit, 8 code rules

## What and why

The UI exists on mock data, but nothing behind it is designed. This ticket produces the written design that all later tickets build from: domain model, database schema, access layer, repository structure, and the order of build tickets. No application code and no migrations are written here.

## In scope

- Domain model: entities, relationships, and ownership (section 1 below).
- Database design: tables, constraints, RLS approach, audit trigger (section 2).
- Access layer: how every action checks role and scope on the server (section 3).
- Repository structure and conventions (section 4).
- Build order as proposed follow-up tickets (section 5).
- List of open questions that block parts of the schema (see Open questions).

## Out of scope

- Writing migrations, installing Clerk, Supabase, or a test framework.
- Any UI.
- Deciding items listed in AGENTS.md section 12.

## Acceptance criteria

- [ ] A human has reviewed sections 1 to 5 and ticked "Plan approved".
- [ ] Open questions are answered by a human and recorded in AGENTS.md section 12.
- [ ] Follow-up tickets from section 5 are created from `tickets/TEMPLATE.md`.

## Test checklist

Tested by AI (tick only after actually running it, and note the command and result):

- [ ] Typecheck, lint and tests pass (no code changes expected)

Tested by a human:

- [ ] Design reviewed against AGENTS.md sections 4, 6, and 7

## Plan (AI fills in before coding)

### 1. Domain model

```
department 1─* course 1─* student
                     │
company 1─* supervisor_membership *─1 user (supervisor)
company 1─* listing 1─* application *─1 student
application (accepted) 1─1 deployment *─1 student
deployment 1─* daily_log
deployment 1─0..1 evaluation 1─0..1 certification
course 1─* evaluation_criterion      (data per course, not code)
user: one row per Clerk identity, with exactly one role
audit_log: append-only, written by trigger
```

Key decisions that follow from AGENTS.md:

- `course` carries `required_hours` and `stale_threshold_days` as data (section 2 rule on per-course data).
- `deployment` links student, company, listing, and course. It is the unit hours accrue against.
- Hours are never stored as a running total. They are computed from approved `daily_log` rows, so a correction or reopen cannot leave a stale total.
- `daily_log.log_date` is a `date` computed in `Asia/Manila` by the server at time in.
- `time_in` and `time_out` are `timestamptz` set by `now()` in the database, never from the client.
- Each log has `break_minutes` (default 0) and nullable `location`.

### 2. Database design

Tables (all with RLS enabled, no direct client writes):

| Table                   | Purpose                                      | Key constraints                                                       |
| ----------------------- | -------------------------------------------- | --------------------------------------------------------------------- |
| departments, courses    | Per-course settings                          | unique code; `required_hours > 0`                                     |
| users                   | Clerk id, role, active flag                  | unique clerk_id; role enum; deactivated users lose access immediately |
| students                | Roster record, course, student number        | unique (course, student_number); unique email                         |
| companies               | Partner companies                            | status enum; owner supervisor reference                               |
| supervisor_memberships  | Supervisor to company                        | exactly one owner per company (partial unique index)                  |
| invitations             | Invitation-only sign-up                      | token hash, role, expiry, used_at                                     |
| roster_imports          | Preview then commit                          | status enum; committed in one transaction                             |
| resumes                 | Storage path, owner                          | one current per student; private bucket                               |
| listings                | Company postings                             | status enum                                                           |
| applications            | Student to listing                           | unique (student, listing)                                             |
| deployments             | Accepted application                         | unique partial index: one active per student                          |
| daily_logs              | Time in/out and journal                      | unique (deployment, log_date); status enum; approved rows locked      |
| evaluations             | Final evaluation                             | one per deployment; blocked until approved hours >= required         |
| evaluation_criteria     | Per course                                   | data, not constants                                                   |
| certifications          | Generated PDF reference                      | one per evaluation                                                    |
| audit_log               | Old value, new value, who, when              | insert only; update and delete revoked and blocked by trigger         |

Guard rails kept in the database:

- Unique (deployment, log_date); unique partial index on active deployment per student.
- A trigger rejects update or delete on `audit_log`, and on `daily_logs` rows with status `approved` unless the change goes through the audited reopen function.
- One audit trigger function attached to daily_logs, evaluations, deployments, courses (required hours), companies (status), and supervisor_memberships.
- The audit trigger reads the acting user from a transaction-local setting that server code sets, so edits made outside the app are recorded as such.
- Accept-application is one Postgres function (create deployment, withdraw other open applications) so it succeeds or fails as a whole.
- Roster commit is one transaction so a bad file never half-imports.

RLS: students read only their own rows; supervisors read rows tied to their company; coordinator reads BSIT rows; admin reads all. No insert, update, or delete policies for user sessions. Writes use the server with the service-role key, only in server-only modules.

### 3. Access layer

- Clerk authenticates. A server helper `requireRole(...)` resolves the Clerk session to a `users` row, checks `active`, and returns `{ userId, role, scope }` where scope is company id, course id, or student id.
- Every server action and route handler does: parse input with Zod, call `requireRole`, check ownership against scope, then write. No step is skipped for "internal" calls.
- Expected failures return `{ ok: false, error }` with a typed code (`validation`, `forbidden`, `not_found`, `conflict`). Only unexpected failures throw.
- File access: private bucket, signed URLs of short life, issued only after the same scope check.
- Tests: one access-rule test per row of the permission table in AGENTS.md section 4, plus tests for each business rule in section 6.
- No external policy engine (for example Cerbos) for the pilot. There are four fixed roles and mostly ownership checks, and the database already enforces the rules that must never break. Keep all checks behind `lib/auth/` so an engine can replace it if other schools or departments bring different rules, or if rules grow past about 50.

### 4. Repository structure

```
app/                     routes by role: (student), supervisor, coordinator, admin
lib/auth/                requireRole, scope resolution
lib/db/                  Supabase clients (server-only), generated types
lib/<domain>/            queries.ts, actions.ts, schemas.ts per domain
lib/audit/               helpers for setting the acting user
supabase/migrations/     SQL migrations, never edited after applying
tests/                   access rules, business rules, migrations
components/<role>/       role-specific UI; components/ui stays shadcn
```

Domains: roster, companies, listings, applications, deployments, logs, evaluations, certifications.

### 5. Proposed build order (follow-up tickets)

1. Test framework and CI checks (needs framework decision).
2. Supabase project, migrations for core schema, guard rails, audit trigger, and RLS, with access tests.
3. Clerk integration, invitation-only sign-up, `requireRole`, consent notice.
4. Admin: companies and supervisor invitations.
5. Coordinator: roster import (preview, commit).
6. Listings, resumes, applications, accept-application function.
7. Daily logs: time in/out, journal, approval, correction, reopen, bulk approve.
8. Evaluation and certification PDF.
9. Replace dashboard mock data with real queries; exports (CSV, DTR PDF).

- [x] Plan approved by a human (approved by the developer in session)

## Open questions (AI writes here instead of guessing)

Answered by the developer in session. A human records them in AGENTS.md section 12 (see "Suggested AGENTS.md changes").

- ANSWERED, test framework: Vitest for unit and access tests, Playwright for browser tests later.
- ANSWERED, forgotten time out: flag it; the supervisor corrects it. The system never invents hours. Still undecided: whether a flagged open entry blocks the student's next time in.
- PROVISIONAL, shift crossing midnight: `log_date` is the date of time in, and a time out on the next day is allowed. Some partner companies run BPO shifts. TO CONFIRM with the coordinator; the unique constraint may change.
- ANSWERED, evaluation criteria: the coordinator creates the evaluation form (criteria rated 1 to 5). The supervisor fills it in per student. Needs a mockup before any UI (AGENTS.md section 9).
- ANSWERED, evaluation visibility: the supervisor (own company's students only), coordinator, and Admin. Other supervisors never see them.
- ANSWERED, certification visibility: the student, coordinator, and Admin.
- ANSWERED, certificate issuer: the coordinator. OPEN: who signs the certificate (name and signature). TO CONFIRM.
- ANSWERED, stale-pending threshold: 3 days (stored per course as data).
- REVISIT, required hours raised after an evaluation is submitted: the developer expects this never to happen, because the school's rules are imported before setup. Working default: an issued certificate stays valid, and the change is audited. DO NOT FORGET: revisit this before the evaluation ticket is built.

## Suggested AGENTS.md changes (a human applies these)

Section 3 and 15, test framework:
- Section 3 add: "Tests: Vitest (unit and access-rule tests), Playwright (browser tests, added once screens exist)."
- Section 15, Tests: `npm run test` once installed.

Section 12, replace the matching open decisions with:
- Forgotten time out: the entry is flagged and the supervisor corrects it. No auto-close.
- Midnight shifts: provisional, `log_date` is the date of time in. To confirm with the coordinator.
- Stale-pending threshold: 3 days.
- Evaluation: the coordinator builds the form (criteria rated 1 to 5); the supervisor completes it.
- Evaluation viewers: supervisor (own company's students), coordinator, Admin. Certification viewers: student, coordinator, Admin.
- Certificate issuer: the coordinator. Signatory still to confirm.
- Raised required hours after evaluation: kept open, revisit before the evaluation ticket.

Section 4 permission table, add rows:
- Create and edit the evaluation form: coordinator only.
- View evaluations: supervisor (own company's students), coordinator, Admin. View certification: student, coordinator, Admin.

## Suggested new tickets (ideas found along the way, not built)

- Mockup for the coordinator's evaluation form builder (criteria list, 1 to 5 scale). Needed before the evaluation ticket.

- Tickets 1 to 9 listed in section 5.
- Add environment variable list to AGENTS.md section 15 once Clerk and Supabase are wired in (proposal for a human to apply).
