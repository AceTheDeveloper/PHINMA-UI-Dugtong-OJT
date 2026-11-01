# AGENTS.md: Dugtong OJT

Read this file first. It states what we are building, the rules the product must follow, and how it should look. It does not say how to structure the project; the repository itself is the source of truth for that. Commands to run it are in section 15. If a task conflicts with this file, stop and ask. If a decision changes, a human updates this file in the same PR (AI agents propose the change in the ticket, see section 14).

## 1. What this project is

Dugtong OJT is a web app (installable PWA) that replaces the paper DTR and scattered OJT paperwork. Students apply to partner companies, log their hours and a daily journal online, company supervisors approve them daily, and the coordinator monitors progress and exports records. When a student reaches the required hours, the supervisor submits a final evaluation and the system generates the student's certification.

- Customer and pilot: PHINMA University of Iloilo, College of Information Technology Education (CITE), BSIT course only.
- This is a long-lived product that future student batches will maintain. Favor clarity, tests, and documentation over cleverness.
- Keep it simple. Do not gold-plate.

## 2. Scope

### In scope (pilot)

- Single school (PHINMA UI), one department (CITE), one course (BSIT).
- Roles: Platform Admin (the devs), Coordinator (one teacher), Supervisor (company staff), Student.
- Admin enters the partner companies the school provides, and invites supervisors.
- Coordinator imports students (CSV or Excel). Students get invitations.
- Resume upload, listings, applications, deployment on acceptance.
- Daily time in/out plus daily journal, with daily supervisor approval.
- Required-hours tracking (coordinator-editable), final evaluation, certification PDF.
- Coordinator dashboard, exports (CSV, printable DTR PDF).
- Full audit logging.

### Out of scope (do NOT build unless asked)

- Other schools or departments (for example CHTM). Store things like required hours, evaluation criteria, and certificate templates as data per course or department, never as constants in code, so adding CHTM later is mostly data entry. Build nothing CHTM-specific.
- Public or guest access. Every page and file requires login, except the public landing page (see section 7).
- Company self-registration and document verification (the school decides partners).
- MOA tracking, OJT requirements and prerequisites, and daily-hours rules other than the supervisor-set work schedule (section 6).
- Partnership request flow, reports and appeals, company trust score.
- Native mobile app, billing, alumni accounts, accreditation export packs.

## 3. Tech stack (what we use)

Next.js (App Router) and TypeScript, installable PWA. Clerk for auth, integrated with Supabase. Supabase Postgres and private Storage. Tailwind CSS, shadcn/ui, react-hook-form, Zod, TanStack Query. Tests: Vitest (unit and access-rule tests); Playwright (browser tests) is added once screens exist. Do not introduce alternatives to these without asking.

Use Tailwind utility classes for component styling and shadcn/ui primitives for standard controls where appropriate. Keep global CSS to design-token variables, font setup, reset/base styles, and narrowly scoped exceptions that utilities cannot express; do not build page layouts in large bespoke CSS files.

## 4. Roles and permissions

| Role           | Who                             | Scope             |
| -------------- | ------------------------------- | ----------------- |
| Platform Admin | The Dugtong developers          | Whole system      |
| Coordinator    | One CITE teacher                | BSIT course       |
| Supervisor     | Company staff, invited by admin | Their own company |
| Student        | Imported by the coordinator     | Self only         |

There is no separate company representative. The first supervisor invited for a company is its owner: the named point of contact, who can invite other supervisors from the same company. Admin can transfer ownership.

| Action                                                   | Student                | Supervisor                     | Coordinator       | Admin                        |
| -------------------------------------------------------- | ---------------------- | ------------------------------ | ----------------- | ---------------------------- |
| View own profile, logs, applications, certification      | yes                    | no                             | no                | yes                          |
| Upload and replace own resume                            | yes                    | no                             | no                | no                           |
| View resumes                                             | own                    | applicants to own company      | all BSIT students | no                           |
| Browse active listings of partner companies              | yes                    | yes (own company)              | yes               | yes                          |
| Create, edit, close listings                             | no                     | own company                    | no                | yes                          |
| Apply to a listing, withdraw an application              | yes                    | no                             | no                | no                           |
| Accept or reject applicants                              | no                     | own listings                   | no                | no                           |
| Time in, time out, write journal                         | own, active deployment | no                             | no                | no                           |
| Approve, reject, correct, reopen daily entries           | no                     | own company's students         | no                | support action only, audited |
| View students' logs and hours                            | own                    | own company's students         | all BSIT students | all                          |
| Edit required hours                                      | no                     | no                             | yes (audited)     | yes (audited)                |
| Import student roster                                    | no                     | no                             | yes               | yes                          |
| Submit evaluation                                        | no                     | own company's students         | no                | no                           |
| Create and edit the evaluation form                      | no                     | no                             | yes               | no                           |
| View evaluations                                         | no                     | own company's students         | all BSIT students | all                          |
| View certification                                       | own                    | no                             | all BSIT students | all                          |
| View and export reports, DTR PDF                         | own DTR                | own company's students         | all BSIT students | all                          |
| Create companies, invite supervisors, create coordinator | no                     | invite colleagues (owner only) | no                | yes                          |

Default: the coordinator cannot approve or change a supervisor's decision. This is an open decision (section 12). The coordinator builds the evaluation form (criteria rated 1 to 5) and the supervisor completes it per student. Other companies' supervisors never see an evaluation. The certification is issued by the coordinator.

## 5. Core flow

1. Admin creates the CITE department, the BSIT course, the coordinator account, the school's partner companies, and invites the first supervisor per company.
2. Coordinator imports the BSIT roster. Each student gets an invitation. Sign-up is invitation-only.
3. Supervisors post listings for their company.
4. Students upload a resume and apply to listings.
5. A supervisor accepts an applicant. Acceptance is final and creates an active deployment immediately. No coordinator confirmation step.
6. Each day the student times in, times out, and writes the journal. The entry becomes pending.
7. The supervisor approves, rejects with a reason, or corrects the entry, daily.
8. Approved hours accumulate toward the course's required hours.
9. When required hours are reached, the supervisor submits the evaluation.
10. The system generates the certification PDF. The coordinator exports records as needed.

## 6. Business rules

These are product rules. Never weaken them to make a feature easier.

### Daily logs

- One entry per deployment per day. Compute the log date in the `Asia/Manila` timezone, not UTC.
- Time in and time out come from the server clock, never the user's device. Never accept a client-provided time for time in or out.
- Statuses: open (timed in), pending (submitted), approved, rejected.
- Only approved entries count toward hours.
- The supervisor can approve, reject with a required reason, or correct times. Every correction keeps the old value in the audit log.
- Rejected entries return to the student to fix and resubmit.
- Approved entries are locked. Only the supervisor can reopen one; Admin can do so only as an audited support action. Every reopening is audited.
- Bulk approve is supported for a day's pending entries.
- Entries pending longer than a set number of days are flagged as stale to the coordinator. The threshold is an open decision.
- An open entry that never timed out is flagged to the supervisor and coordinator. The system never auto-closes it or invents hours. The supervisor sets the time out. A flagged entry does not block the student's next time in.
- Each deployment has a work schedule (days, start and end times, in `Asia/Manila`) set by the supervisor. Only the supervisor can change it, and a change applies from then on, not to a single day. The schedule decides which date an entry belongs to, so night shifts that cross midnight map to the date of time in, and it is how a forgotten time out is detected.
- A time out before the scheduled end is blocked, unless the student gives a reason. With a reason the entry is saved as an early out and shown to the supervisor with that reason. The server decides by its own clock, never the client's. Only approved hours actually worked count.
- A student can time in from 30 minutes before the scheduled start. The window is stored as data, not a constant in code.
- Overtime, meaning time outside the schedule, must be requested by the student first.
- The early time out reason is free text, and the daily approval covers it. This is provisional; see section 12.
- Each entry has a break duration (default 0, supervisor-editable) and an optional location, so break deduction and location checks can be added later without redesign.

### Applications and deployments

Rules marked "default" are implemented as written until a human changes them. Do not ask about them again, and do not change them on your own.

- Default (confirm with the coordinator): a student may apply to several listings but may have only one active deployment.
- Accepting an application creates the deployment and withdraws the student's other open applications. This must succeed or fail as a whole, never half-done.

### Evaluation and certification

- Evaluation unlocks only when approved hours are at least the course's required hours.
- Submitting the evaluation generates the certification PDF.

### Roster import

- Preview first (validation: duplicates, missing emails, wrong course), then commit. A bad file must never half-import.

## 7. Security, privacy, and audit

- Every page, route, and file requires login, except the public landing page at `/` and its non-OJT branding assets. The landing page contains no OJT data. No other public data. All OJT storage is private. Use short-lived signed links for files.
- Role and scope are checked on the server for every action. Never trust the client for role, company, student, or time.
- **Users never write to tables directly.** All changes go through server code that first checks the caller's role and ownership (for example, a supervisor can only approve entries of their own company's students).
- Row Level Security is enabled on every table, and user sessions get read access only where needed (students see only their own data).
- The service-role key is server-only. Never expose it to client code, never put it in a `NEXT_PUBLIC_` variable, never commit it.
- Resumes are visible only to the student, the coordinator, and supervisors of companies the student applied to.
- Sign-up is invitation-only. Deactivated accounts lose access immediately.
- Consent notice at first login. Student data is collected only for OJT, with limited retention, designed to follow the Philippine Data Privacy Act of 2012.
- Never log or print personal data, tokens, or keys. Never commit `.env` files.

### Audit

Changes to daily logs, evaluations, deployments, work schedules, required hours, company status, and company membership are recorded with old value, new value, who, and when. Audit records can be added but never edited or deleted.

### Database guard rails

These are standing rules, kept in the database so a future bug cannot break them:

- One log per deployment per day.
- One active deployment per student.
- A single audit trigger records the changes listed above, including edits made outside the app.
- Approved entries and audit rows cannot be edited or deleted, except through the audited reopen action.

## 8. Code rules

- TypeScript strict. No `any`.
- Validate every input at the boundary with Zod (forms, server actions, route handlers, CSV rows).
- Expected failures (validation, permission, not found) return a typed error result instead of throwing.
- Schema changes are migrations kept in git. No manual dashboard edits.
- Every access rule has a test, for example "student A cannot read student B's logs".
- Add or update tests with the code.

## 9. UI and copy

- Build from approved mockups. Do not invent screens. If there is no mockup, ask.
- Support light and dark themes. Follow the system preference until the user chooses a theme, and remember explicit choices.
- Use the design tokens for both themes; do not add raw color values in components.
- Sentence case everywhere. Verb-first buttons ("Time in", "Reject entry", "Approve all").
- Errors say what happened and what to do, in one sentence, with no "Error:" prefix.
- Do not use "successfully", "please", or "click here".
- Turn on tabular numerals for hours, times, and totals.

## 10. Design tokens

Light-mode values are measured from the existing landing page, except values marked suggested. Pending, rejected, hover, and neutral colors are suggested additions. Dark-mode values are defined in the `.dark` token set. The stylesheet in the repo is what ships: if it differs from the blocks below, fix one of them in the same PR.

```css
:root {
  /* Foundation */
  --primary: #2563eb;
  --primary-hover: #1d4ed8; /* suggested */
  --primary-tint: #e6eefe;
  --primary-track: #d4e0fb;
  --ink: #0f172a;
  --muted: #596579;
  --faint: #6b7686; /* suggested; the page's #798393 is too low-contrast for small text */
  --disabled: #98a2b3; /* suggested */
  --border: #eceef2;
  --border-strong: #d5dae2; /* suggested */
  --surface: #f5f7fa;
  --page-wash: #f8fafe;
  --focus-ring: rgb(37 99 235 / 0.4); /* suggested */

  /* Success */
  --success-tint: #d9f5ea;
  --success-border: #a8e3cb;
  --success: #087a55;
  --success-hover: #066245;
  --success-text: #087a55;

  /* Warning (suggested) */
  --warning-tint: #fef3c7;
  --warning-border: #f6d776;
  --warning: #b45309;
  --warning-hover: #92400e;
  --warning-text: #92400e;

  /* Error (suggested) */
  --error-tint: #fee2e2;
  --error-border: #fca5a5;
  --error: #dc2626;
  --error-hover: #b91c1c;
  --error-text: #b91c1c;

  /* Info */
  --info-tint: #e6eefe;
  --info-border: #bcd0fb;
  --info: #2563eb;
  --info-hover: #1d4ed8;
  --info-text: #1e40af;

  /* Teal */
  --teal-tint: #ddf4f4;
  --teal-border: #a9dcdc;
  --teal: #086a6a;
  --teal-hover: #065454;
  --teal-text: #086a6a;

  /* Neutral (suggested) */
  --neutral-tint: #eef1f5;
  --neutral-border: #dfe3ea;
  --neutral: #596579;
  --neutral-hover: #475569;
  --neutral-text: #596579;

  /* shadcn/ui aliases (suggested; mirror the .dark set) */
  --background: #ffffff;
  --foreground: #0f172a;
  --card: #ffffff;
  --card-foreground: #0f172a;
  --popover: #ffffff;
  --popover-foreground: #0f172a;
  --primary-foreground: #ffffff;
  --secondary: #ddf4f4;
  --secondary-foreground: #086a6a;
  --muted-foreground: #596579;
  --accent: #e6eefe;
  --accent-foreground: #1e40af;
  --destructive: #dc2626;
  --input: #d5dae2;
  --ring: #2563eb;
}
```

Use text on tint with the matching `-text` color, and white text on solid fills. These pairs are meant to meet the 4.5:1 contrast target, but that has not been measured for every pair (light `--faint` on `--surface` is borderline). Check with a contrast tool whenever you add or change a pair.

Dark-mode tokens:

```css
.dark {
  --primary: #60a5fa;
  --primary-hover: #93c5fd;
  --primary-tint: #172b48;
  --primary-track: #24456f;
  --ink: #f1f5f9;
  --muted: #a6b2c4;
  --faint: #aab7ca;
  --disabled: #64748b;
  --border: #263449;
  --border-strong: #3b4b63;
  --surface: #152238;
  --page-wash: #0b1220;
  --focus-ring: rgb(96 165 250 / 0.4);
  --success-tint: #12342e;
  --success-border: #28604e;
  --success: #087a55;
  --success-hover: #066245;
  --success-text: #6ee7b7;
  --warning-tint: #3a2d12;
  --warning-border: #7a5a1c;
  --warning: #b45309;
  --warning-hover: #92400e;
  --warning-text: #fcd34d;
  --error-tint: #3b1d25;
  --error-border: #7c2c3b;
  --error: #dc2626;
  --error-hover: #b91c1c;
  --error-text: #fca5a5;
  --info-tint: #172b48;
  --info-border: #294c7e;
  --info: #2563eb;
  --info-hover: #1d4ed8;
  --info-text: #93c5fd;
  --teal-tint: #123536;
  --teal-border: #276466;
  --teal: #086a6a;
  --teal-hover: #065454;
  --teal-text: #5eead4;
  --neutral-tint: #202c3e;
  --neutral-border: #3a4a61;
  --neutral: #596579;
  --neutral-hover: #475569;
  --neutral-text: #cbd5e1;
  --background: #0b1220;
  --foreground: #f1f5f9;
  --card: #111b2e;
  --card-foreground: #f1f5f9;
  --popover: #111b2e;
  --popover-foreground: #f1f5f9;
  --primary-foreground: #0b1220;
  --secondary: #123536;
  --secondary-foreground: #5eead4;
  --muted-foreground: #a6b2c4;
  --accent: #172b48;
  --accent-foreground: #93c5fd;
  --destructive: #f87171;
  --input: #3b4b63;
  --ring: #93c5fd;
}
```

In dark mode, use `--primary-foreground` on the primary fill; do not assume white text remains readable on a lighter primary color. Keep all text/background pairs at or above 4.5:1 contrast.

`--destructive` is the shadcn alias of the error role. In dark mode it is lighter than `--error`, so put `--primary-foreground` text on it, not white.

### Status to color role

| Where       | State                            | Role            |
| ----------- | -------------------------------- | --------------- |
| Daily entry | Clocked in (open)                | info            |
| Daily entry | Pending                          | warning         |
| Daily entry | Approved                         | success         |
| Daily entry | Rejected                         | error           |
| Daily entry | Stale pending                    | warning (solid) |
| Application | Applied                          | info            |
| Application | Accepted                         | success         |
| Application | Rejected                         | error           |
| Application | Withdrawn                        | neutral         |
| Deployment  | Active                           | success         |
| Deployment  | Completed / ready for evaluation | teal            |
| Deployment  | Ended or inactive                | neutral         |
| Student     | Scope acknowledged               | teal            |

Use the error solid fill only for destructive actions. Everything else that is wrong stays in the tint, so a table with several problems does not turn red.

## 11. Fonts (proposed, confirm)

Plus Jakarta Sans for headings (700 and 800), Inter for body and UI (400 and 600), JetBrains Mono for times and IDs. Always include system font fallbacks.

## 12. Open decisions

Do not decide these on your own. Ask in the ticket's "Open questions"; a human records the answer here.

- Certificate signatories. The coordinator issues the certificate; whose name and signature appear on it is to be confirmed.
- Fonts (section 11 is proposed, not confirmed).
- Shifts that cross midnight (BPO night shifts). Provisional: the entry belongs to the date of time in, and the time out may fall on the next day. To confirm with the coordinator; the one-log-per-day constraint may change.
- REVISIT: what happens if the coordinator raises required hours after the evaluation is submitted. Expected to never happen, since the school's rules are imported before setup. Working default: an issued certificate stays valid and the change is audited. Decide before the evaluation ticket.
- Evaluation form: the coordinator defines the criteria, rated 1 to 5. Needs a mockup for the form builder before any UI.
- Can the coordinator override a supervisor's approval decision? Default: no.
- Stale-pending threshold is 3 days, stored per course as data. Reminder timing is still open.
- Lunch-break rule for hours (default: none deducted).
- Late time in: how it is treated. Suggested: allowed, recorded and shown as late to the supervisor, with hours counted from the actual time in. Not decided.
- Hours for an early arrival (time in within the 30 minutes before the scheduled start): count from the scheduled start or from the actual time in. Suggested: from the scheduled start. Not decided.
- Overtime request: who approves it (suggested: the supervisor), how the student requests it, and whether it needs a reason. Needs a mockup before any UI.
- Swapped day: whether it is a one-time exception for a single date (suggested, requested by the student and approved by the supervisor) or a permanent schedule change. Permanent changes are made by the supervisor editing the schedule. To ask the coordinator.
- REMEMBER, early time out approval: the reason is free text and the daily approval covers it, because supervisors may be busy. Ask the supervisors and coordinator whether they want a separate approval step.
- Application rules: several applications allowed, one active deployment (confirm).
- UI language (English assumed).

## 13. Rules for AI agents

Do:

- Read this file before changing anything. Prefer the smallest change that completes the task.
- Enforce the business rules in section 6 on the server, not only in the UI.
- Add or update tests with the code.
- Ask when a requirement is unclear or missing, in the ticket's "Open questions". A human records the answer in this file.
- Test, commit, and push every logical change automatically, following section 14.

Do not:

- Build anything listed under "Out of scope".
- Use the client clock for any hours-related timestamp.
- Write to tables from the client, or use the service-role key outside server-only code.
- Edit applied migrations, generated files, or audit rows.
- Add public routes, public storage, or guest access.
- Invent UI without a mockup, or invent business rules. Add them to "Open decisions" instead.
- Add dependencies without a clear reason.

### Definition of done

- Matches the mockup and the rules in this file.
- Permission checks and tests exist for every new action or table.
- Zod validation on every new input.
- Audit coverage for any new change to hours, evaluations, or deployments.
- Typecheck, lint, and tests pass (commands in section 15).

## 14. Working on tickets

- Work only from a ticket file in `tickets/`. No ticket, no coding. Read `AGENTS.md`, the ticket, and the mockup first.
- If anything needed is missing or unclear, write the question under "Open questions" in the ticket and stop. Do not guess.
- For anything bigger than a small change, write a plan in the ticket and wait until a human ticks "Plan approved".
- Do only what "In scope" says. New ideas go under "Suggested new tickets", never into the code.
- Order of authority: `AGENTS.md`, then the ticket, then your own ideas. If the first two conflict, stop and ask.
- Never edit `AGENTS.md`, other tickets, or the scope of the current ticket unless a human says so. To change `AGENTS.md`, write the proposal under "Suggested AGENTS.md changes" in the ticket; a human applies it.
- Test, commit, and push automatically; do not wait to be asked. After each logical change:
  1. Run the checks in section 15 (typecheck, lint, tests). Fix failures before going on.
  2. Only if every check passes, commit with the message `ticket-XX: short message`. Never commit code that fails a check.
  3. Push that commit to `origin/<developer-branch>`.
- Several developers work in this repository, each on their own branch named after them. Never assume whose branch it is: find it with `git branch --show-current`. Commit and push only if that branch is not `dev`, `test`, or `main`, and it matches the developer you are working for (the ticket's Assignee, or the developer who started the session). If it is `dev`, `test`, `main`, or another developer's branch, or you are not sure, stop and ask instead of committing.
- Work only on a ticket assigned to the developer you are working for. If the ticket's Assignee is someone else, stop and ask. Do not take over or edit another developer's ticket or branch.
- Never commit or push to `dev`, `test`, or `main`; never force-push. If a check or a push fails, report the failure with its output and do not claim the change was published. Never merge into `dev` yourself; a human opens and merges the PR.
- One ticket at a time per branch. Do not start the next ticket until the previous one is merged into `dev`.
- Tick the "Tested by AI" boxes only for commands you actually ran, and write the command and result next to them. Never tick a human box.
- Before the PR: merge the latest `dev` into the branch and run the checks again. You may resolve trivial conflicts (imports, formatting). Stop and ask a human for conflicts in auth, database migrations, audit logic, or the section 6 rules.
- Git steps for humans are in `contributing.md`.

## 15. Local setup

Commands, run from the repository root:

- Install: `npm install`
- Run locally: `npm run dev`
- Lint: `npm run lint`
- Typecheck: `npx tsc --noEmit`
- Build: `npm run build`
- Tests: `npm run test` (single run). Watch mode: `npm run test:watch`.

The checks that gate every commit and push (section 14) are lint, typecheck, and tests. Run `npm run test` before every commit and every push; do not commit or push if it fails.

TODO (project owner): add environment variables once Clerk and Supabase are wired in. Never commit secrets.

<!-- ## 16. Reference

- Final Development Plan (Claude Doc): link to be added.
- Mockups: link or folder to be added.
- Existing landing page (visual reference): https://dugtong-ojt.vercel.app/ -->
