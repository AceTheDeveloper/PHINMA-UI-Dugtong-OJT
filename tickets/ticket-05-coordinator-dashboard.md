# ticket-05: Coordinator dashboard (mock data and mock navigation)

- Type: feature
- Assignee: TBD
- Status: in progress
- Mockup: Missing; see Open questions.
- AGENTS.md sections: 2 (scope), 4 (roles), 5 (core flow), 6 (business rules), 7 (security), 9 (UI and copy), 10 (design tokens), 13 and 14 (AI rules)

## What and why

Build the first version of the coordinator's home screen: the page a teacher opens to see how every student in their course is doing on OJT, what needs attention, and where to export records. This ticket is front-end only. All numbers come from mock data and the navigation is mock, so the layout and information can be reviewed before auth, Supabase, or any real data exists. The product will eventually serve the whole university, but the pilot is PHINMA UI, CITE, BSIT only, so nothing on the screen may hard-code the school, department, course, or required hours; they come from the mock data the same way they will later come from the database.

## In scope

Layout, mock data, and mock navigation for a single coordinator dashboard page. The information the coordinator needs, taken from AGENTS.md sections 4 to 6:

**Header**

- Page title, plus the school, department, and course names shown as data (not constants).
- Required hours for the course, shown as data. Display only; editing is out of scope.
- A mock "as of" date.

**Summary cards (counts)**

- Total students in the course.
- Students with an active deployment.
- Students not yet deployed (no active deployment: applying, or no application yet).
- Students ready for evaluation (approved hours at least the required hours).
- Evaluations submitted and certifications generated.

**Attention needed**

- Stale pending entries: entries waiting for supervisor approval longer than the threshold, with student, company, and how many days they have waited. The threshold is an open decision, so the mock uses a placeholder value read from mock data.
- Students ready for evaluation whose supervisor has not submitted it yet.
- Open entries that were never timed out. How these are handled is an open decision, so the mock only lists them.

**Student progress table**

- One row per student: name, student ID, company, deployment status, approved hours out of required hours with a progress bar, pending entries count, and date of the last entry.
- Search by name or ID, filter by deployment status and by company, and sort by progress.
- Hours, times, and counts use tabular numerals. Student ID in the mono font.
- Status badges follow the "Status to color role" table in section 10. Use the matching tokens only, no raw colors.
- Each row is read-only. The coordinator cannot approve, reject, or edit hours here (section 4).

**Partner companies overview**

- One row or card per company: company name, supervisors count, active students, and total approved hours.

**Quick actions (mock buttons that do nothing)**

- Import roster, Export CSV, Export DTR PDF. Verb-first labels.
- The roster import button only shows where the preview-then-commit flow will start (section 6). No file handling.

**Recent activity (mock)**

- A short list of recent events such as "Supervisor approved 12 entries" or "Required hours changed". Read-only. This previews the audit log; it is not the audit log.

**Mock navigation**

- A persistent sidebar on desktop and a collapsible menu on mobile. Items: Dashboard, Students, Companies, Daily logs, Evaluations, Reports, Roster import, Audit log.
- Only Dashboard is a real page. The other items are visibly marked as not built yet and lead nowhere (inert, not links to new pages), so no extra screens are invented.
- A user area with the mock coordinator's name and a theme toggle that follows the existing theme setup.

**Mock data**

- One typed mock data module, for example `lib/mock/coordinator.ts`, that the page reads from. No data is hard-coded in components.
- All names, student IDs, and company names are clearly fictional. No real student, teacher, or company data. Section 7 forbids real personal data in code.
- Enough rows to exercise the states: every status in the color table, a student at 0 hours, one at exactly the required hours, one over, a stale pending entry, and a company with no deployed students.

**shadcn/ui components and blocks**

- Build the page from shadcn/ui components and blocks, added with the shadcn CLI so the source lives in `components/ui/` and follows the existing `components.json`. Do not hand-build controls that shadcn already provides.
- Start from the shadcn dashboard and sidebar blocks (for example `dashboard-01` and a sidebar block such as `sidebar-07`) and adapt them to the sections above. Remove what the ticket does not ask for: no sample charts, drag-and-drop, or demo data that the coordinator does not need.
- Use shadcn primitives for the pieces they cover: Sidebar, Card, Table, Badge, Progress, Input, Select, Button, Tabs or Toggle where needed, Sheet for the mobile menu, Tooltip, Avatar, Separator, and Skeleton if loading states are shown.
- Restyle through the design tokens in section 10 (the shadcn alias variables already exist for both themes). No raw color values and no bespoke CSS for layout.
- Status badges are a small shared wrapper around the shadcn Badge that maps each status to its color role, so the mapping lives in one place.

**Quality**

- Light and dark themes using the design tokens.
- Responsive from 390 px mobile to desktop. On mobile the student table becomes a readable stacked layout, not a sideways scroll.
- Accessible: heading order, labelled search and filters, focus states, progress bars with text values, color never the only signal.
- Copy follows section 9: sentence case, no "successfully", "please", or "click here".

## Out of scope

- Authentication, role checks, route protection, Supabase, Clerk, or any real data access.
- Real filtering on the server, pagination from a database, or live updates.
- Any other page: Students detail, Companies, Daily logs, Evaluations, Reports, Roster import, Audit log screens.
- Editing required hours, approving or changing entries, importing a roster, or generating any export or PDF.
- Notifications, reminders, or email.
- Anything specific to another school, department, or course.
- Supervisor and student dashboards.

## Acceptance criteria

- [x] A coordinator dashboard page renders every section listed under "In scope" using mock data only.
- [x] School, department, course, required hours, and the stale threshold are read from mock data, not written into components.
- [x] The mock data module contains the states listed under "Mock data" and no real personal data.
- [x] The sidebar and mobile menu show all eight items; only Dashboard is active and the rest are marked as not built.
- [ ] Search, status filter, company filter, and progress sort work on the mock students.
- [x] The page and shell are built from shadcn/ui components and dashboard and sidebar blocks added through the shadcn CLI, with unused block content removed.
- [ ] Status badges and progress use design tokens and the status-to-color table, in both light and dark themes.
- [x] Hours, times, and counts use tabular numerals.
- [x] The page is usable at 390×844 and 1440×900 without horizontal page scroll.
- [x] No buttons or controls change data, and no network or backend calls are made.
- [x] Copy follows section 9.

## Test checklist

Tested by AI (tick only after actually running it, and note the command and result):

- [x] `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass (all clean; `/coordinator` prerendered as static). No test runner is installed yet.
- [ ] Each acceptance criterion checked in the browser at 1440×900 and 390×844, in light and dark themes. (Done so far: light theme at 1440 wide with headless Chrome screenshots, and at a true 390 wide viewport via an iframe; dark theme not verified.)
- [ ] Tests for the filter, search, and sort logic, once a test framework is chosen (section 12).

Tested by a human:

- [ ] Worked through in the browser as the coordinator (who and when: \_\_\_)
- [ ] Coordinator confirms the screen shows what they would need to check each day (who and when: \_\_\_)

## Plan (AI fills in before coding)

Proposed, not started:

1. Add the typed mock data module and a small set of helpers (counts, progress, stale flags) kept separate from components.
2. Add the needed shadcn components and the dashboard and sidebar blocks with the CLI, then strip them down to what this ticket needs.
3. Build the shell: sidebar, mobile menu, header, theme toggle, with the inert navigation items.
4. Build the summary cards and the attention panel.
5. Build the student progress table with search, filters, sort, and the mobile stacked layout.
6. Build the partner companies overview, quick actions, and recent activity.
7. Check both themes, both viewports, and accessibility, then run the checks.

- [ ] Plan approved by a human

## Open questions (AI writes here instead of guessing)

- Resolved in chat: the human said to start building. I took that as accepting the proposed defaults below: the section list as the brief, route `/coordinator` (unlinked, with a "Mock data" label, `noindex`), placeholder stale threshold (3 days) and required hours (300), all eight nav items, and plain shadcn Table with no new libraries. The "Plan approved" box is left for a human to tick.
- Branch rule: section 14 says not to start a ticket until the previous one is merged into `dev`. Tickets 01 to 04 are not merged yet; this work sits on top of them on `ace`. Merge order matters for the PR.
- Not verified yet: dark theme in a browser (my headless run did not switch themes), search, filter and sort interaction by hand, and mobile menu opening. A human should check these.
- Still open: test framework, so the filter and sort logic in `lib/coordinator/metrics.ts` has no tests yet.

Original questions:

- Mockup: there is none. Section 9 says not to invent screens. Is the section list above approved as the brief, in place of a mockup, the way the "Campus-to-career" brief was for ticket-04? Please also say if anything should be added or dropped.
- Route: where does the mock page live, for example `/coordinator`? Section 7 says every page requires login except `/`, but auth does not exist yet, so this page would be reachable by anyone until it does. Proposed: do not link it from the landing page or sign-in page, and show a visible "Mock data" label on it. Is that acceptable, or should this ticket wait for auth?
- Stale-pending threshold: open decision in section 12. The mock will use a placeholder; confirm that is fine.
- Required hours: the mock needs a number. Proposed placeholder is clearly labelled as mock. Confirm, or give the real BSIT figure.
- Navigation items: is the eight-item list right, or should it be shorter for the first version?
- Dependencies: the shadcn dashboard block pulls in extra packages (for example a table library, a charts library, and drag-and-drop). Section 13 says not to add dependencies without a clear reason, and TanStack Table and a charts library are not in the stack in section 3. Proposed: take only the layout and the shadcn primitives, and use the plain shadcn Table with no new libraries. Confirm, or approve specific extra packages.
- Test framework (section 12): needed before logic tests can be written for the filters and sorting.

## Suggested new tickets (ideas found along the way, not built)

- Student detail view for the coordinator (read-only logs and hours).
- Roster import with preview then commit (section 6).
- Supervisor dashboard and student dashboard in the same shell.
- Stale-pending reminders, once the threshold decision is made.
- Choose and install a test framework.

## Suggested AGENTS.md changes (a human applies these)

- Sections 1 and 2 describe a single-school pilot. The direction is now a university-wide product with a PHINMA UI, CITE, BSIT pilot. Suggest rewording "In scope (pilot)" so the pilot limits what is built for now but states that school, department, and course are data. Section 2 already says to store required hours and similar values as data; this extends the same rule to names and labels shown in the UI.
