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
- Deciding items listed in `plan.md`.

## Acceptance criteria

- [ ] A human has reviewed sections 1 to 5 and ticked "Plan approved".
- [ ] Open questions are answered by a human and recorded in `plan.md`.
- [ ] Follow-up tickets from section 5 are created from `tickets/TEMPLATE.md`.

## Test checklist

Tested by AI (tick only after actually running it, and note the command and result):

- [ ] Typecheck, lint and tests pass (no code changes expected)

Tested by a human:

- [ ] Design reviewed against AGENTS.md sections 4, 6, and 7

## Plan (AI fills in before coding)

See `plan.md`, section "Plan: system design".

- [x] Plan approved by a human (approved by the developer in session)

## Open questions (AI writes here instead of guessing)

Answered by the developer in session. They are recorded in `plan.md`.

- ANSWERED, test framework: Vitest for unit and access tests, Playwright for browser tests later.
- ANSWERED, forgotten time out: flag it; the supervisor corrects it. The system never invents hours. A flagged entry does not block the student's next time in. Recorded in `plan.md`.
- PROVISIONAL (now in `plan.md`), shift crossing midnight: `log_date` is the date of time in, and a time out on the next day is allowed. Some partner companies run BPO shifts. TO CONFIRM with the coordinator; the unique constraint may change.
- ANSWERED, evaluation criteria: the coordinator creates the evaluation form (criteria rated 1 to 5). The supervisor fills it in per student. Needs a mockup before any UI (AGENTS.md section 9).
- ANSWERED, evaluation visibility: the supervisor (own company's students only), coordinator, and Admin. Other supervisors never see them.
- ANSWERED, certification visibility: the student, coordinator, and Admin.
- ANSWERED, certificate issuer: the coordinator. OPEN: who signs the certificate (name and signature). TO CONFIRM.
- ANSWERED, stale-pending threshold: 3 days (stored per course as data).
- ANSWERED, student work schedules: the supervisor sets the schedule per deployment and can change it (applies from then on, not per day). It is enforced. Recorded in `plan.md`. Schema impact: add a `work_schedules` table per deployment, audited. Remaining details are in `plan.md`.
- ANSWERED, early time out: blocked unless the student gives a reason; with a reason it is saved as an early out and flagged to the supervisor. Actual hours only.
- REVISIT, required hours raised after an evaluation is submitted: the developer expects this never to happen, because the school's rules are imported before setup. Working default: an issued certificate stays valid, and the change is audited. DO NOT FORGET: revisit this before the evaluation ticket is built.

## Suggested AGENTS.md changes (a human applies these)

- None. Decisions and plans moved to `plan.md`.

## Suggested new tickets (ideas found along the way, not built)

- Mockup for the coordinator's evaluation form builder (criteria list, 1 to 5 scale). Needed before the evaluation ticket.

- Tickets 1 to 9 listed in section 5.
- Add environment variable list to AGENTS.md section 15 once Clerk and Supabase are wired in (proposal for a human to apply).
