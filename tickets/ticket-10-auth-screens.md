# ticket-10: Auth screens and landing page redesign (UI only)

- Type: feature
- Assignee: Arwin Clyde B. Simondac
- Status: in progress
- Mockup: design canvas https://claude.ai/artifact/APqaZ2x74WjcWfxQHugUmz (approved by the developer, with the AI-proposed design)
- AGENTS.md sections: 3 stack, 7 security, 9 UI and copy, 10 design tokens, 11 fonts
- Plan: `plan.md`, "Plan: auth screens and landing page redesign (ticket-10)" (approved)

## What and why

The landing page and sign-in screen still describe the old "replace the paper DTR" idea, and the sign-in screen needs a more modern look. This ticket redesigns the landing page, rebuilds the sign-in screen, and adds the accept-invitation, data privacy consent, no-invitation, and deactivated-account screens. It is UI only with mock behavior. Wiring to Clerk and the database is ticket-09.

## In scope

- Landing page `/`: header, hero with sample product cards, "One journey, six steps", "Who it's for", "Records you can rely on", team section with animated avatars (Ace, Josiah, Neil, Khent, Bonnie), final call to action, footer.
- `/sign-in`: Google button, email and password, show or hide password, side panel with sample cards.
- `/accept-invitation`, `/consent`, `/no-access`, `/deactivated`.
- Light and dark themes through the existing tokens; theme toggle on every screen.
- Mock navigation between the screens so the flow can be reviewed.
- Animated team avatars as inline SVG, still when the visitor prefers reduced motion.

## Out of scope

- Clerk, sessions, role checks, redirects, or any data access (ticket-09).
- Real form validation and submit behavior (comes with react-hook-form and Zod in ticket-09).
- Real photos or roles for the team.
- Final consent wording (draft text with a placeholder for the retention period).

## Acceptance criteria

- [x] `/` shows the new sections in order, with the approved copy from the plan (checked in the production HTML; light and dark follow the tokens, human to confirm visually).
- [x] The team section shows five animated avatars with first names; the animation stops with reduced motion (five avatars confirmed in the HTML; `motion-reduce:animate-none` is set; the animation itself needs a human look).
- [x] `/sign-in` has the Google button, email and password fields, and a show or hide password control (present in the HTML; clicking it needs a human check).
- [x] `/accept-invitation`, `/consent`, `/no-access`, and `/deactivated` exist (200 from the production build); matching the design needs a human check.
- [x] On `/consent`, "Accept and continue" is disabled until the checkbox is ticked (disabled in the server HTML; ticking the box needs a human check).
- [x] No raw color values in components, except the Google mark and the avatar artwork (grep found none elsewhere).
- [x] Every screen works at 390 and 1440 px wide, without horizontal scroll.
- [x] No Clerk, backend, or data code was added.
- [x] Lint, typecheck, tests, and build pass.

## Test checklist

Tested by AI (tick only after actually running it, and note the command and result):

- [x] Lint, typecheck, tests, and build pass (`npm run lint` clean, `npx tsc --noEmit` clean, `npm run test` 5 files and 50 tests passed, `npm run build` compiled and prerendered 8 routes)
- [x] Each route returns 200 from a production build (`next start`, curl on `/`, `/sign-in`, `/accept-invitation`, `/consent`, `/no-access`, `/deactivated`: all 200)

Tested by a human:

- [x] Reviewed every screen in the browser on desktop and mobile, in light and dark
- [x] Checked the avatar animation and reduced motion

## Plan (link to the plan in plan.md; plan first for any new feature)

See `plan.md`, "Plan: auth screens and landing page redesign (ticket-10)".

- [x] Plan approved by a human (approved by the developer in session)

## Open questions (AI writes here instead of guessing)

- Consent wording is a draft. Who writes and approves the final notice is tracked in `to-confirm.md`.
- The mock screens `/consent`, `/no-access`, and `/deactivated` are reachable without a session in this ticket because there is no auth yet. They hold no OJT data. In ticket-09 they require a session, and only `/`, `/sign-in`, and `/accept-invitation` stay public.

## Suggested AGENTS.md changes (a human applies these)

- None.

## Suggested new tickets (ideas found along the way, not built)

- Forgot-password screen (the link is inert in this ticket).
- Replace the animated avatars with team photos when available.
