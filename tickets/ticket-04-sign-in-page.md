# ticket-04: Sign-in page

- Type: feature
- Assignee: TBD
- Status: in review
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

- [x] The `/sign-in` page presents the approved visual-only email/password form.
- [x] The desktop layout pairs the focused form with the static School → Company → Completion illustration.
- [x] On mobile, the illustration becomes a compact banner above the form.
- [x] The illustration is clearly illustrative and does not present itself as a live dashboard.
- [x] The page uses existing Dugtong blue/teal design tokens and remains accessible and usable across supported viewport sizes.
- [x] No authentication or backend behavior is changed.

## Test checklist

Tested by AI (tick only after actually running it, and note the command and result):

- [x] `npx.cmd tsc --noEmit`, `npm.cmd run lint`, and `npm.cmd run build` pass; no test script is configured in `package.json`.
- [x] Browser-verified each acceptance criterion at 1440×900 and 390×844, including mobile order, focus/skip-link behavior, theme toggle, and inert Sign in button.

Tested by a human:

- [x] Reviewed sign-in page in the browser on desktop and mobile

## Plan (AI fills in before coding)

- [x] Use the “Campus-to-career” design brief as the visual reference, as approved by the human.
- [x] Use the human-approved visual-only Email and Password fields and Sign in button; do not implement authentication or submit behavior.
- [x] Implement the responsive sign-in presentation and static School → Company → Completion illustration using existing tokens and UI conventions.
- [x] Verify desktop and mobile layouts, accessibility, and existing checks without changing authentication or backend behavior.
- [x] Plan approved by a human

## Open questions (AI writes here instead of guessing)

- Resolved: The human approved the “Campus-to-career” brief in place of a mockup and approved Email and Password fields with a Sign in button as a visual-only form. Authentication and submit behavior remain out of scope.

## Suggested new tickets (ideas found along the way, not built)

-
