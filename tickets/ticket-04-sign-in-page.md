# ticket-04: Sign-in page

- Type: feature
- Assignee: TBD
- Status: todo
- Mockup: Missing; see Open questions.
- AGENTS.md sections: 3 (stack), 7 (security), 9 (UI and copy), 10 (design tokens), 13 and 14 (AI rules)

## What and why

Create the frontend sign-in page for Dugtong OJT at `/sign-in`, the destination already linked from the landing page. Use a “Campus-to-career” visual direction: a focused sign-in form beside a static illustrative pathway showing School → Company → Completion, with the illustration adapted into a compact banner above the form on mobile. The page should feel polished, purposeful, uncluttered, and use the existing Dugtong blue/teal design language.

## In scope

- The sign-in page layout and presentation only.
- A focused form that follows the project's existing sign-in and auth conventions once identified; do not choose a sign-in method.
- A static pathway illustration showing School → Company → Completion. It must not resemble a live dashboard or imply live data.
- Responsive desktop split layout and compact mobile banner above the form.
- Existing design tokens, typography, and shared UI conventions.

## Out of scope

- Changes to authentication or backend behavior, providers, routes beyond the sign-in page, or data access.
- Sign-up or any public access; accounts remain invitation-only.
- New auth methods, fields, links, or flows not established by the project.
- A live dashboard, live status indicators, or real OJT data in the illustration.

## Acceptance criteria

- [ ] The `/sign-in` page presents the approved sign-in form using existing project/auth conventions.
- [ ] The desktop layout pairs the focused form with the static School → Company → Completion illustration.
- [ ] On mobile, the illustration becomes a compact banner above the form.
- [ ] The illustration is clearly illustrative and does not present itself as a live dashboard.
- [ ] The page uses existing Dugtong blue/teal design tokens and remains accessible and usable across supported viewport sizes.
- [ ] No authentication or backend behavior is changed.

## Test checklist

Tested by AI (tick only after actually running it, and note the command and result):

- [ ] Typecheck, lint and tests pass
- [ ] Each acceptance criterion has a test

Tested by a human:

- [ ] Reviewed sign-in page in the browser on desktop and mobile (who and when: ___)

## Plan (AI fills in before coding)

- [ ] Confirm the approved mockup (or approval to use the supplied design brief in its place) and the existing auth UI conventions.
- [ ] Implement the responsive frontend using the confirmed project/auth conventions without changing authentication or backend behavior.
- [ ] Verify desktop and mobile layouts, accessibility, and existing checks.
- [ ] Plan approved by a human

## Open questions (AI writes here instead of guessing)

- Provide an approved sign-in mockup, or confirm that the “Campus-to-career” design brief in this ticket is approved in place of a visual mockup.
- Which existing sign-in UI/auth conventions should the form follow? The inspected repository contains no sign-in route, auth components, or provider configuration, so the form fields, labels, and submit behavior cannot yet be derived without choosing a new sign-in method.

## Suggested new tickets (ideas found along the way, not built)

-
