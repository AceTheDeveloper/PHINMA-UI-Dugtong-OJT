# plan.md

Feature plans, settled decisions, and open decisions for Dugtong OJT. `AGENTS.md` holds the general rules; this file holds what we are building and why.

## How to use this file

1. **Plan first.** Before adding a new feature, the developer writes a plan under "Plans" (one section per feature) and a human approves it.
2. The ticket links to its plan here. No approved plan, no coding (small changes excepted).
3. New business rules or unclear points go under "Open decisions". A human records the answer under "Decisions".
4. Questions for the school are tracked in `to-confirm.md`.

Plan template:

```
### Plan: <feature> (ticket-XX) [draft | approved | done]
- What and why
- Data and rules affected
- Steps, in order
- Tests
- Open questions
```

## Decisions (settled)

### Tooling and structure

- Tests: Vitest for unit and access-rule tests; Playwright for browser tests once screens exist.
- No external policy engine (for example Cerbos) for the pilot. Keep all authorization behind `lib/auth/` so one can replace it later.

### Evaluation and certification

- The coordinator builds the evaluation form (criteria rated 1 to 5). The supervisor completes it per student. Needs a mockup before any UI.
- The coordinator issues the certificate.
- Permissions to add to the table in AGENTS.md section 4 when built:

| Action                              | Student | Supervisor             | Coordinator       | Admin |
| ----------------------------------- | ------- | ---------------------- | ----------------- | ----- |
| Create and edit the evaluation form | no      | no                     | yes               | no    |
| View evaluations                    | no      | own company's students | all BSIT students | all   |
| View certification                  | own     | no                     | all BSIT students | all   |

- Other companies' supervisors never see an evaluation.

### Structure and listings

- PHINMA UI only. No tenant column; school name and timezone live in a single-row `school_settings` table.
- OJT runs once per school year, for 4th years. A batch (`ojt_batches`) is one course's OJT in one school year and holds its required hours, so a later change applies to the next batch only.
- Partner companies are one school-wide list, entered once. Each listing says which courses can apply (`listing_courses`).
- A student's listings page shows only listings open to their own course, chosen automatically from the student's course and enforced on the server and in RLS. No course filter for students. Search by company or title is fine.

### Daily logs and schedules

- Stale-pending threshold is 3 days, stored per course as data.
- An open entry that never timed out is flagged to the supervisor and coordinator. The system never auto-closes it or invents hours. The supervisor sets the time out. A flagged entry does not block the student's next time in.
- Each deployment has a work schedule (days, start and end times, in `Asia/Manila`) set by the supervisor. Only the supervisor can change it, and a change applies from then on, not to a single day. It is enforced. Work schedules are audited like other hours-related changes.
- The schedule decides which date an entry belongs to (provisional: the date of time in, so night shifts map to the date of time in). It is also how a forgotten time out is detected. This makes the supervisor-set schedule an exception to "daily-hours rules" being out of scope.
- A student can time in from 30 minutes before the scheduled start. The window is stored as data.
- A time out before the scheduled end is blocked unless the student gives a reason. With a reason the entry is saved as an early out and shown to the supervisor with that reason. The server clock decides. Only approved hours actually worked count.
- The early time out reason is free text, and the daily approval covers it. Provisional, see REMEMBER below.
- Overtime (time outside the schedule) must be requested by the student first.

## Open decisions

Do not decide these on your own. Ask in the ticket's "Open questions".

- Certificate signatories: the coordinator issues it; whose name and signature appear is to be confirmed.
- Shifts that cross midnight (BPO): provisional rule above. Confirm with the coordinator; the one-log-per-day constraint may change.
- REVISIT: if the coordinator raises required hours after an evaluation is submitted. Expected to never happen, since the school's rules are imported before setup. Working default: an issued certificate stays valid and the change is audited. Decide before the evaluation ticket.
- REMEMBER, early time out approval: free text, covered by the daily approval because supervisors may be busy. Ask the supervisors and coordinator whether they want a separate approval step.
- Late time in: suggested, allowed and shown as late, with hours counted from the actual time in.
- Hours for an early arrival (within the 30-minute window): suggested, count from the scheduled start.
- Overtime request: who approves (suggested: the supervisor), how it is requested, whether it needs a reason. Needs a mockup.
- Swapped day: suggested, a one-time exception requested by the student and approved by the supervisor; permanent changes are the supervisor editing the schedule. To ask the coordinator.
- Reminder timing for stale pending entries.
- Can the coordinator override a supervisor's approval decision? Default: no.
- Lunch-break rule for hours (default: none deducted).
- Application rules: several applications allowed, one active deployment (confirm).
- Fonts (AGENTS.md section 11 is proposed, not confirmed).
- UI language (English assumed).

## Plans

### Plan: system design (ticket-06) [approved]

#### 1. Domain model

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

#### 2. Database design (superseded by "Plan: core schema" below)

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

#### 3. Access layer

- Clerk authenticates. A server helper `requireRole(...)` resolves the Clerk session to a `users` row, checks `active`, and returns `{ userId, role, scope }` where scope is company id, course id, or student id.
- Every server action and route handler does: parse input with Zod, call `requireRole`, check ownership against scope, then write. No step is skipped for "internal" calls.
- Expected failures return `{ ok: false, error }` with a typed code (`validation`, `forbidden`, `not_found`, `conflict`). Only unexpected failures throw.
- File access: private bucket, signed URLs of short life, issued only after the same scope check.
- Tests: one access-rule test per row of the permission table in AGENTS.md section 4, plus tests for each business rule in section 6.
- No external policy engine (for example Cerbos) for the pilot. There are four fixed roles and mostly ownership checks, and the database already enforces the rules that must never break. Keep all checks behind `lib/auth/` so an engine can replace it if other schools or departments bring different rules, or if rules grow past about 50.

#### 4. Repository structure

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

#### 5. Proposed build order (follow-up tickets)

1. Test framework and CI checks (needs framework decision).
2. Supabase project, migrations for core schema, guard rails, audit trigger, and RLS, with access tests.
3. Clerk integration, invitation-only sign-up, `requireRole`, consent notice.
4. Admin: companies and supervisor invitations.
5. Coordinator: roster import (preview, commit).
6. Listings, resumes, applications, accept-application function.
7. Daily logs: time in/out, journal, approval, correction, reopen, bulk approve.
8. Evaluation and certification PDF.
9. Replace dashboard mock data with real queries; exports (CSV, DTR PDF).

#### 6. Work schedules (added after approval)

Add a `work_schedules` table per deployment (days, start and end time, effective-from), set only by the supervisor and audited. Daily logs read the schedule to assign the log date, enforce the time out rule, and detect forgotten time outs. Details are under "Daily logs and schedules" in Decisions.


### Plan: core schema (ticket-08) [draft]

#### What and why

The database for the pilot (PHINMA UI, CITE, BSIT) that can grow to the whole university without a rewrite. Rule of thumb: **nothing about CITE or BSIT is a constant in code or in a column name.** CITE and BSIT are rows. Adding another department or course later is data entry plus, at most, a new coordinator assignment. We build nothing department-specific (AGENTS.md section 2).

#### Principles

- **Config is data, per course.** Required hours, stale threshold, time-in window, evaluation form, and certificate template all hang off a course or an OJT batch.
- **Scope is explicit.** Every row traces to a course (students, evaluations) or a company (supervisors, listings). RLS and `requireRole` check that chain, never a hard-coded course.
- **History is never rewritten.** Rules that change over time (required hours, schedule, evaluation form) are versioned or snapshotted, so old records stay correct.
- **Foreign keys over flexibility.** Separate assignment tables, not one polymorphic "scope" column, so the database enforces the links.
- `uuid` primary keys, `created_at` and `updated_at` on every table, deactivate instead of delete.

#### Entity groups

**A. Academic structure**

| Table       | Purpose                                                      | Notes                                                                                              |
| ----------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| school_settings | PHINMA UI only. A single-row table                       | `name`, `timezone` (default `Asia/Manila`). A check keeps it to one row. No tenant column anywhere else. |
| departments | CITE now, others later                                       | unique code                                                                                        |
| courses     | BSIT now                                                     | FK department; unique code                                                                         |
| ojt_batches | One OJT batch of a course: the students doing OJT in one school year | FK course; `school_year` (for example 2026-2027), unique (course, school_year); `required_hours`, `stale_threshold_days` (3), `time_in_window_minutes` (30), dates, status |

`ojt_batches` is the key future-ready piece. Required hours live on the batch, so a later change applies to new batches and old batches keep their original value. This also removes most of the "required hours raised after evaluation" worry. The REVISIT item stays open for the rules.

**B. People and access**

| Table                   | Purpose                              | Notes                                                                                                 |
| ----------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| users                   | One row per Clerk identity           | unique `clerk_id`; `role` enum (admin, coordinator, supervisor, student); `is_active`                 |
| coordinator_assignments | Which courses a coordinator manages  | (user, course). Many allowed, so a second coordinator or a department-wide one later is rows, not code |
| students                | Roster record                        | FK user (null until the invite is accepted), course, ojt_batch; unique (batch, student_number); unique email |
| supervisor_memberships  | Supervisor belongs to a company      | exactly one owner per company (partial unique index)                                                  |
| invitations             | Invitation-only sign-up              | role, target (student or company), token hash, expiry, used_at                                        |
| consents                | Data privacy notice acceptance       | (user, notice_version, accepted_at)                                                                   |

The pilot (one coordinator, BSIT only) is just one `coordinator_assignments` row.

**C. Companies and listings**

| Table           | Purpose                           | Notes                                                                                           |
| --------------- | --------------------------------- | ----------------------------------------------------------------------------------------------- |
| companies       | Partner companies, school-wide    | status enum. Not tied to a department, since one company can host several departments           |
| listings        | Company postings                  | FK company; status enum                                                                         |
| listing_courses | Which courses a listing is open to | (listing, course). Pilot: every listing targets BSIT. Students see only listings for their course |

**D. Applications and deployment**

| Table              | Purpose                                | Constraints                                                                                       |
| ------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| resumes            | Storage path per student               | one current per student; private bucket                                                           |
| applications       | Student to listing                     | unique (student, listing); status enum                                                            |
| deployments        | Accepted application                   | FK student, company, listing, ojt_batch; unique partial index: one active per student; status enum |
| work_schedules     | Supervisor-set schedule per deployment | `effective_from`; audited; the newest effective row applies                                       |
| work_schedule_days | Days and times of a schedule           | (schedule, weekday, start_time, end_time); an end earlier than the start means the shift ends the next day (night shift) |

**E. Daily logs**

`daily_logs`: deployment, `log_date` (in the school timezone), `time_in` and `time_out` (server `now()`), `break_minutes` (default 0), `location` (nullable), `journal`, `status` (open, pending, approved, rejected), `reject_reason`, `early_out_reason`, `approved_by`, `approved_at`, and a **snapshot of the scheduled start and end** taken at time in, so a later schedule change never rewrites old entries. Unique (deployment, log_date). Late, early out, and forgotten time out are computed from the snapshot, not stored as separate truth.

**F. Evaluation and certification**

| Table                 | Purpose                              | Notes                                                                                          |
| --------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| evaluation_forms      | Coordinator-built form per course    | `version`, `scale_min` 1, `scale_max` 5, status draft or published; published forms are immutable |
| evaluation_criteria   | Criteria of a form                   | label, position                                                                                |
| evaluations           | Supervisor's submitted evaluation    | one per deployment; references the exact form version used                                     |
| evaluation_scores     | Rating per criterion                 | (evaluation, criterion); value within the form's scale                                         |
| certificate_templates | Per course: issuer and layout data   | signatories stored as data; the signatory is still to confirm                                  |
| certifications        | Generated PDF                        | one per evaluation; storage path; references the template version                              |

**G. Audit**

`audit_log`: table name, row id, action, old value (jsonb), new value (jsonb), actor user, source (`app` or `database`), timestamp. Insert only.

**Deferred on purpose** (waiting on open decisions, added as later migrations): overtime requests, swapped-day exceptions, roster import staging (added with the roster ticket), stale reminders.

#### Guard rails in the database

- Unique (deployment, log_date); one active deployment per student; one owner per company; one evaluation per deployment.
- Time out must be after time in. Hours are computed from approved logs, never stored as a running total.
- Audit trigger on daily_logs, evaluations, deployments, work_schedules, ojt_batches (required hours), companies (status), and supervisor_memberships. It reads the acting user from a transaction-local setting that server code sets, so edits made outside the app are recorded as `database`.
- `audit_log` rejects update and delete. Approved logs reject update and delete except through the audited reopen function.
- Accept-application is one Postgres function (create the deployment, withdraw the other open applications). It is all or nothing.
- Evaluation insert is rejected unless approved hours are at least the batch's required hours.

#### Access (RLS)

- A helper reads the Clerk user id from the token and resolves the `users` row.
- Select policies only. No insert, update, or delete policies for user sessions; all writes go through server code with the service-role key.
- Students read their own rows. Supervisors read rows of their company's deployments. Coordinators read rows whose course is in their `coordinator_assignments`. Admin reads all.
- Evaluations: supervisor (own company's students), coordinator, admin. Certifications: student (own), coordinator, admin.

#### Migration order

1. Academic structure (school_settings, departments, courses, ojt_batches) and seed rows for PHINMA UI, CITE, BSIT.
2. Users, assignments, students, invitations, consents.
3. Companies, listings, listing_courses.
4. Resumes, applications, deployments, work schedules.
5. Daily logs.
6. Evaluation forms, evaluations, scores, certificate templates, certifications.
7. Audit log and triggers.
8. RLS policies and helper functions.

Each migration ships with database tests for its guard rails.

#### Testing

- No Docker (developer machines cannot run it), so `supabase test db` and a local Supabase are out.
- Database rules (constraints, triggers, audit, RLS) are tested inside Vitest with PGlite, which is real Postgres compiled to WebAssembly and runs in-process. Migrations are plain SQL files applied to PGlite in the test setup. Supabase-only functions such as `auth.jwt()` are stubbed in one test helper.
- PGlite is not identical to hosted Supabase. So each migration is also applied to the hosted dev project with `supabase db push` and checked by hand before the PR.
- First step of ticket-08 is a small spike to confirm PGlite handles our triggers and RLS. If it does not, fall back to a separate hosted Supabase test project.
- Server logic stays in Vitest (ticket-07).
- Every row of the permission table in AGENTS.md section 4 gets an access test, for example "student A cannot read student B's logs".

#### Open questions

1. ANSWERED, one school or several: PHINMA UI only. No tenant column; school name and timezone live in a single-row `school_settings` table.
2. ANSWERED, OJT batches as the home of required hours: yes. OJT runs once per school year, only for 4th years, and a batch shares the same required hours. Renamed `ojt_terms` to `ojt_batches`.
3. ANSWERED, companies shared across departments: yes. One school-wide company list; `listing_courses` says which courses a listing is open to.
4. ANSWERED, Docker: not available on any developer machine. Database tests use PGlite (see Testing).
5. TO CONFIRM with the school: does it need anything beyond one coordinator per course, such as a department head with read-only access? Tracked in `to-confirm.md`. The model already allows several coordinators.

- [ ] Plan approved by a human

### Plan: test framework (ticket-07) [done]

Install Vitest with `npm run test` and one example test. Done in ticket-07.
