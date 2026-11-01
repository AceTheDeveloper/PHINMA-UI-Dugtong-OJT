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
- Data retention: how long student data, resumes, and files are kept, and what happens when a batch closes (Data Privacy Act). Ask the school; tracked in `to-confirm.md`.
- REMEMBER, Clerk webhook: sync a changed email into `users.email`, and when a Clerk account is deleted, deactivate our `users` row. Not needed while building (we match on the Clerk id, so nothing breaks), but do it before the pilot goes live. Needs a public webhook route and a signing secret, which is the reason it was left out of ticket-09.
- REMEMBER, Resend: invitation emails move from Clerk's default to Resend later. The developer has questions about it to discuss first.
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


### Plan: core schema (ticket-08) [approved]

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

#### Status values and transitions

Enums are listed here so migrations, server code, and tests agree. Transitions not listed are rejected by the database.

| Enum                   | Values                                   | Allowed transitions                                                                                          |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| user_role              | admin, coordinator, supervisor, student  | none (a user keeps one role)                                                                                 |
| company_status         | active, inactive                         | either way (audited)                                                                                         |
| listing_status         | open, closed                             | open to closed, closed to open                                                                               |
| application_status     | applied, accepted, rejected, withdrawn   | applied to accepted, rejected, or withdrawn. The other three are final.                                       |
| deployment_status      | active, completed, ended                 | active to completed (evaluation submitted) or ended (supervisor or admin ends it early). Both are final.     |
| daily_log_status       | open, pending, approved, rejected        | open to pending (time out and journal); pending to approved or rejected; rejected to pending (resubmit); approved to pending (audited reopen) |
| ojt_batch_status       | planned, active, closed                  | planned to active to closed                                                                                  |
| invitation_status      | pending, used, expired, revoked          | pending to used, expired, or revoked                                                                         |
| evaluation_form_status | draft, published, archived               | draft to published to archived; published forms are immutable                                                |

"Ready for evaluation" and "stale pending" are computed, not stored statuses. The reopen target (`pending`) is a design choice: after a reopen the supervisor corrects the entry and approves it again.

#### Hours calculation

- Entry minutes = (`time_out` minus `time_in`) minus `break_minutes`, never below 0. The exact interval is used; there is no per-entry rounding.
- A deployment's approved hours = the sum of entry minutes of its approved logs, divided by 60. Rounding happens only for display (two decimals).
- Hours are exposed through a database view (`deployment_hours`), so the dashboard, the evaluation gate, and the DTR export all read the same number.
- Which start counts for an early arrival is an open decision (see Open decisions). Until decided, the actual `time_in` is used and the view is the one place to change it.

#### Writes and the audit actor

- The Supabase JS client sends each request as its own transaction, so a setting made in one call is gone in the next. The audit actor therefore cannot be set from separate calls.
- **Rule:** every state-changing action is a Postgres function called with `rpc`, taking the actor's user id as a parameter. Inside one transaction the function sets the actor (`set_config('app.actor', ..., true)`), does the change, and lets the audit trigger read it.
- Server code still validates with Zod and checks role and scope first. The functions for hour-related and approval actions (time in, time out, approve, reject, correct, reopen, accept application, submit evaluation) also verify the actor's role and scope, so a server bug alone cannot skip a rule.
- Execute on these functions is revoked from `anon` and `authenticated`; only the service role can call them. A wrapper in `lib/db/` is the single place server code calls them.
- An edit made outside the app (for example the dashboard SQL editor) has no actor set, so the audit row is recorded with source `database` and no actor.

#### File storage

- Two private buckets: `resumes` and `certificates`. No policies for user sessions, so files can only be read through signed links.
- Paths: `resumes/{student_id}/{uuid}.pdf` and `certificates/{deployment_id}/{certification_id}.pdf`.
- A signed link is issued by the server, only after the same role and scope check as the data, and lasts 60 seconds.
- Resumes: PDF only, 5 MB maximum (design choice, adjustable). Replacing a resume adds a new row and marks the old one not current; the old file is kept until the retention rule is decided.

#### Other constraints and seed data

- A supervisor belongs to exactly one company (unique `user_id` in `supervisor_memberships`).
- `log_date` is computed by a database function from `time_in` and `school_settings.timezone`; it is never sent by the client.
- `school_settings` is seeded by a migration (it is required for the system to run). Development data (CITE, BSIT, a 2026-2027 batch, sample users) is in `supabase/seed.sql` and is never applied to production. Test fixtures are built inside the tests.

#### Guard rails in the database

- Unique (deployment, log_date); one active deployment per student; one owner per company; one evaluation per deployment.
- Time out must be after time in. Hours are computed from approved logs, never stored as a running total.
- Audit trigger on daily_logs, evaluations, deployments, work_schedules, ojt_batches (required hours), companies (status), and supervisor_memberships. It reads the actor set by the write functions (see "Writes and the audit actor"), so edits made outside the app are recorded as `database`.
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
2. Users, coordinator assignments, students, consents.
3. Companies, supervisor memberships, invitations, listings, listing_courses.
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
5. TO CONFIRM with the school (does not block the build): does it need anything beyond one coordinator per course, such as a department head with read-only access? Tracked in `to-confirm.md`. The model already allows several coordinators.

- [x] Plan approved by a human (approved by the developer in session)

### Plan: authentication and authorization (ticket-09) [draft]

#### What and why

Sign-in, invitation-only sign-up, and the server checks that every later feature relies on. Clerk answers "who is this person". Our own database answers "what are they allowed to do". Nothing else in the app should have to think about auth: it calls one helper and gets a role and scope, or a typed refusal.

#### Verified facts (checked against Clerk and Next.js docs on 2026-11-01)

- Next.js 16 calls the request interceptor `proxy.ts` (it was `middleware.ts` before). Clerk's own advice is to protect access close to the data, not only in the proxy.
- Clerk's native Supabase integration replaces the deprecated JWT template. Clerk adds `role: authenticated` to session tokens, the Clerk user id is the `sub` claim, and supabase-js takes an `accessToken` function that returns the Clerk token.
- Clerk's **Invite-only** access mode (API value `restricted`) is what blocks sign-up without an invitation. An invitation by itself does not restrict anything.
- `createInvitation` accepts `emailAddress`, `publicMetadata`, `redirectUrl`, `expiresInDays` (default 30), and `notify`. The invitation's `publicMetadata` is copied to the user when they sign up. Revoking an invitation is not confirmed from the docs yet; confirm during the build.

#### Principles

- **Clerk is identity only.** Role, scope, and active state come from our database on every request. Roles are never read from a Clerk token or metadata, so they cannot be stale or forged.
- **Fail closed.** No session, no `users` row, inactive user, wrong role, or wrong scope all end in a refusal.
- **Check next to the data.** The proxy only sends signed-out visitors to sign in. Real authorization happens in server layouts, server actions, and route handlers through one helper. The proxy is never the only check.
- **Deactivation is immediate** because every request reads `is_active` from our database. Deactivating also bans the Clerk user and revokes their sessions, but the database check is the one that counts.

#### How a person gets in

1. An authorized person creates an invitation (`create_invitation`). It stores the role and target (student, company, or course) in our `invitations` table and creates the matching Clerk invitation, with our invitation id in its `publicMetadata`.
2. The invitee opens the Clerk email link, lands on `/accept-invitation`, and sets their password. Clerk's invite-only mode means this is the only way to create an account.
3. On their first authenticated request, the server finds no `users` row for their Clerk id, so it **provisions them just in time**: it reads their verified primary email and the invitation id from their Clerk profile, then calls `accept_invitation`. The function checks the invitation is pending, not expired, and addressed to that email, then in one transaction creates the `users` row, links the roster record (student), membership (supervisor, first one becomes owner), or course assignment (coordinator), and marks the invitation used.
4. If the person has not accepted the current data privacy notice, they are sent to the consent screen before anything else.
5. They land on their role home: `/student`, `/supervisor`, `/coordinator`, or `/admin`.

Why just-in-time instead of a Clerk webhook: no public webhook route, no signing secret, and no race where a person lands before the webhook has run. A webhook can be added later for email changes and deletions.

The first admin uses the same flow: `npm run bootstrap:admin -- <email>` is a script that calls `create_invitation` for the admin role and sends the Clerk invitation.

#### Database changes (migration 4)

Migrations 1 to 3 may already be on the hosted project, so these are changes in a new migration, not edits.

- `invitations`: drop `token_hash` (Clerk issues the token), add `clerk_invitation_id` (unique), add `course_id` (a coordinator invitation needs a course), and update the target check: student needs a student, supervisor needs a company, coordinator needs a course, admin needs none.
- `school_settings`: add `consent_notice_version` (data, so a new notice is a data change).
- Functions, all called through `rpc` with the actor id and executable only by the service role:
  - `create_invitation(actor, role, email, target)` enforces who may invite whom: admin invites any role; a supervisor who owns a company invites supervisors to that company; a coordinator invites students of their courses.
  - `accept_invitation(clerk_id, email, full_name, invitation_id)` is atomic and idempotent (a second call for the same Clerk id returns the existing user).
  - `record_consent(user, notice_version)`.
  - `set_user_active(actor, user, active)`.

#### Code

| Path                             | Purpose                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `proxy.ts`                       | Clerk proxy. Public: `/`, `/sign-in`, `/accept-invitation`, and branding assets. Everything else needs a session. |
| `lib/result.ts`                  | The typed result `{ ok: true, data } or { ok: false, error: { code, message } }` for expected failures. |
| `lib/auth/session.ts`            | `getSession()` resolves Clerk id to our user and scope, provisioning on first visit.                 |
| `lib/auth/authorize.ts`          | `authorize(roles)` for actions and route handlers (returns a result). `requireRole(roles)` for pages and layouts (redirects). |
| `lib/auth/scope.ts`              | Scope: student id, course ids, company id and owner flag, resolved in one query.                      |
| `lib/auth/provision.ts`          | The just-in-time step above.                                                                         |
| `lib/db/admin.ts`                | Service-role Supabase client. Marked `server-only`; never imported by client code.                   |
| `lib/db/user.ts`                 | Supabase client using the Clerk token, so reads obey RLS. Used once the RLS select policies exist.   |
| `lib/db/rpc.ts`                  | The single wrapper server code uses to call the write functions.                                     |
| `scripts/bootstrap-admin.ts`     | Creates the first admin invitation.                                                                  |
| `.env.example`                   | Variable names with empty values.                                                                    |
| `app/(roles)/layout.tsx` and the role homes | Layouts call `requireRole` and the consent gate.                                          |

Session shape: `{ userId, clerkId, role, studentId?, courseIds?, companyId?, isCompanyOwner? }`.

New dependencies, each with a reason: `@clerk/nextjs` (auth), `@supabase/supabase-js` (database client), `zod` (input validation, AGENTS.md section 8), `server-only` (keeps secrets out of the client bundle).

#### Screens (need mockups before any UI)

- Sign-in: exists as a visual-only page (ticket-04). This ticket makes it work, with no visual change.
- Accept invitation (set password): proposed to reuse the sign-in layout.
- Consent notice: proposed as a single card with the notice text and an "Accept and continue" button.
- Not invited or no access, and deactivated account: one plain message screen each.

#### Tests

- Database tests (PGlite): `accept_invitation` for each role, wrong email, expired, already used, revoked, second call, and rollback on failure; first supervisor becomes owner and the second does not; `create_invitation` allows and refuses each role pairing; `set_user_active`.
- Unit tests with injected Clerk and database fakes: no session, not provisioned, inactive user, wrong role, wrong scope, correct scope.
- A test that lists the public routes, so adding a public route fails the build until someone updates it on purpose.
- Browser tests (Playwright) come with the first real role-gated screen.

#### Environment variables

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only), `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (server-only). No webhook secret is needed. These names are added to AGENTS.md section 15.

#### Steps for the human (dashboards)

1. Clerk: set the access mode to **Invite-only**, then activate the Supabase integration and copy the Clerk domain.
2. Supabase: Authentication, Sign In / Providers, add Clerk, paste the domain.
3. Clerk: turn on email and password sign-in with email verification, and Google as a social connection. In development Clerk's shared Google credentials work; production needs our own.
4. Clerk: enable the authenticator app as a second step.

#### Open questions

1. ANSWERED, sign-in methods: email and password, plus Google. A Google account is accepted only if its verified email matches the invitation (our `accept_invitation` checks this). In production, Google sign-in needs our own Google OAuth credentials, which the human creates in Google Cloud.
2. ANSWERED (confirm the explanation), two-step verification: yes. Required for Admin, optional for the others. This is a second code from an authenticator app after the password, not device trust. Clerk's plan limits for it are checked when building; our `requireRole` can refuse an Admin whose Clerk account has no second step.
3. ANSWERED, invitation lifetime: 7 days, resendable by whoever sent it.
4. ANSWERED, screens: the developer wants the sign-in screen revised (the current one is not modern enough) and has no mockup, so the AI proposes the design and the developer approves it before it is built. Suggested: do the four auth screens (sign-in, accept invitation, consent, no access) as one UI-only ticket first, with mock behavior, then wire them to Clerk.
5. ANSWERED, invitation email: Clerk's default for now. REMEMBER: move to Resend later. The developer has questions about Resend to discuss first.
6. DECIDED (developer left it to the AI), Clerk instances: use the development instance while building. Create the production instance, with its own keys, its own Google OAuth credentials, and the production domain, before any real student or supervisor is invited. Development users and invitations do not carry over, so creating it early avoids re-inviting people.
7. DECIDED, changed or deleted emails: skip for now. REMEMBER (see Open decisions): add a Clerk webhook for `user.updated` and `user.deleted` before the pilot goes live.

- [ ] Plan approved by a human

### Plan: auth screens and landing page redesign (ticket-10) [draft]

#### What and why

The product is no longer only "replace the paper DTR". It now covers applying to partner companies, deployment, daily logs, evaluation, and certification, for the whole university over time. The landing page copy and the sign-in screen no longer say that, and the sign-in screen needs a more modern look. This ticket redesigns the landing page and builds the four auth screens, UI only, with mock behavior (no Clerk). Wiring to Clerk is ticket-09.

Design proposal for review (private canvas, developer only): https://claude.ai/artifact/APqaZ2x74WjcWfxQHugUmz

#### Screens

| Screen               | Route                | Notes                                                                                           |
| -------------------- | -------------------- | ----------------------------------------------------------------------------------------------- |
| Landing page         | `/`                  | Public. Redesigned. Adds a team section. No OJT data.                                           |
| Sign in              | `/sign-in`           | Google button, email and password, show or hide password, forgot password link.                 |
| Accept invitation    | `/accept-invitation` | Shows the invited email and role, Google or set a password, expiry note.                        |
| Data privacy consent | `/consent`           | Four summary cards, one checkbox, "Accept and continue" disabled until checked.                 |
| No invitation found  | `/no-access`         | For a signed-in person with no invitation. "Try another account" and "Sign out".                |
| Account deactivated  | `/deactivated`       | "Sign out" only.                                                                                |

#### Design direction

- Same brand: AGENTS.md section 10 tokens (light and dark), Plus Jakarta Sans for headings, Inter for body, JetBrains Mono for times and numbers. Fonts are still "proposed" in AGENTS.md section 11, so this follows that proposal.
- Calmer and more modern: larger type, more space, 16 to 28 px rounded cards with a soft shadow, a faint dot grid behind illustrations, flat tinted panels instead of the old dark panel, and status badges that use the existing color roles.
- The hero and the sign-in side panel show the product through sample cards (clocked in, approved hours, pending approvals, certification). They are drawn in HTML, not screenshots, use fictional data, and are labeled "Sample data".
- Landing sections: header, hero, "One journey, six steps", "Who it's for" (student, supervisor, coordinator), "Records you can rely on", "Built by the Dugtong team", final call to action, footer.

#### Copy (proposed, needs approval; the approved copy of ticket-01 no longer fits)

- Hero H1: "Your OJT, from application to certification."
- Hero subtext: "Apply to partner companies, log your hours and a short daily journal, get them approved the same day, and receive your certification when you finish. One place for students, supervisors, and coordinators."
- Hero line: "Accounts are by invitation only."
- Six steps: Apply, Get accepted, Log the day, Approve daily, Evaluate, Get certified.
- Team heading: "Built by the Dugtong team." Names: Ace, Josiah, Neil, Khent, Bonnie.
- Footer: "Built for PHINMA University of Iloilo."
- The "Records you can rely on" lines are kept from ticket-01.
- The consent summary is draft wording. The retention line is a placeholder until the school answers (see `to-confirm.md`).

#### Build notes

- Build with Tailwind utilities and shadcn/ui primitives using the existing tokens; no new colors in components. Light and dark themes both work.
- Mock behavior only: the sign-in button and the other buttons navigate between the screens or do nothing. No Clerk, no data. Real behavior arrives in ticket-09.
- The logo is `public/dugtong-mark.png`. The Google button uses a plain placeholder glyph in the proposal; the build uses the official Google mark.
- The team section uses initials in tinted circles. Photos or roles can be added later.
- Existing `/sign-in` and `/` pages are replaced. The theme toggle stays available on every public screen.

#### Tests

- Vitest for any logic (for example the consent button gate).
- Browser checks at 1440 and 390 wide, in light and dark, on each screen.
- Playwright comes later with the first role-gated screen.

#### Open questions

1. **Team section.** Names only (as proposed), or also a role and a photo for each person? Last names?
2. **"Built for PHINMA University of Iloilo"** in the footer: is this wording acceptable for a public page?
3. **Landing copy.** Approve the proposed H1, subtext, and six steps, or edit them?
4. **Hero badge.** The proposal has a small teal badge above the headline ("Online training, tracked end to end"). Keep or remove?
5. **Consent wording.** Who writes the final notice, and who approves it (the school or its data privacy officer)?

- [ ] Plan approved by a human

### Plan: test framework (ticket-07) [done]

Install Vitest with `npm run test` and one example test. Done in ticket-07.
