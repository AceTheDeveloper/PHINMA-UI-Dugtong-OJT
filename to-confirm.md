# To confirm with the school

Questions we still need to ask the coordinator or supervisors. When you get an answer, tell the AI to record it in `plan.md`, then tick it here.

## Ask the coordinator

- [ ] **Midnight and BPO shifts.** Some partner companies run night shifts. We assume an entry belongs to the date of time in, and the time out can fall on the next day. Is that how the school counts it?
  - Affects: one-log-per-day rule, `daily_logs` and `work_schedules` tables.
- [ ] **Who signs the certificate.** The coordinator issues it. Whose name and signature appear on the PDF: the coordinator, the department head, or both?
  - Affects: certificate template data.
- [ ] **Swapped days.** A one-time exception for a single date (for example Saturday instead of Friday this week), requested by the student and approved by the supervisor. Is that right, or does the school treat a swap as a permanent change?
  - Affects: schedule exceptions, daily logs ticket.
- [ ] **Late and early-arrival handling.** We suggest: late time in is allowed and shown as late, with hours counted from the actual time in. An early arrival (up to 30 minutes before the start) counts from the scheduled start. Does the school agree?
  - Affects: hour computation in the daily logs ticket.
- [ ] **Overtime requests.** Who approves them (we suggest the supervisor), and does the student need to give a reason?
  - Affects: a new request screen (needs a mockup).

- [ ] **Extra coordinator roles.** The system allows several coordinators, each assigned to courses. Does the school need anything beyond one coordinator, such as a department head with read-only access, or a second coordinator per course?
  - Affects: `coordinator_assignments` and RLS in the core schema (ticket-08).

- [ ] **Data retention.** How long should student data, resumes, and certificates be kept, and what should happen when a batch closes (archive, delete, anonymize)? Ask the school, and its data privacy officer if there is one.
  - Affects: deletion jobs, file storage, the consent notice text.

- [ ] **Data privacy notice wording.** Who writes the final consent notice, and who approves it (the school or its data privacy officer)? The consent screen has a placeholder for how long data is kept.
  - Affects: the consent screen text (ticket-10) and the retention rule.

## Ask the supervisors and the coordinator

- [ ] **Early time out approval.** The reason is free text and the daily approval covers it, because supervisors may be busy. Do they want a separate approval step for early outs?
  - Affects: daily approval flow.

## Revisit later (not for the school)

- [ ] **Required hours raised after an evaluation.** Expected to never happen. Working default: an issued certificate stays valid and the change is audited. Decide before the evaluation ticket is built.
