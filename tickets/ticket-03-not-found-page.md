# ticket-03: Not-found page

- Type: feature
- Assignee: Ace
- Status: todo
- Mockup: None.
- Related files: `AGENTS.md`, `app/not-found.tsx`, `app/globals.css`, `components/ui/button.tsx`

## What and why

Create a branded 404 not-found page for Dugtong that matches the existing design system and provides a clear way back to the landing page.

## In scope

- Add a Next.js App Router `not-found.tsx` page.
- Use Tailwind utilities and the existing shadcn/ui button where appropriate.
- Use existing Dugtong design tokens, typography, logo, focus styles, and light/dark theme behavior.
- Keep the page public and free of OJT data.

## Out of scope

- New routes or auth logic.
- New images, illustrations, or dependencies.
- Changing the existing landing page.

## Plan

- Confirm the exact approved message and action label in the open question.
- Implement the branded not-found page with a return-home link.
- Verify the page in light and dark themes, check keyboard focus and responsive widths, and run typecheck, lint, and production build.

- [x] Plan approved by a human

## Open questions

- Approved copy:
  - Heading: Page not found
  - Supporting text: The page you're looking for doesn't exist or may have moved.
  - Return-home action: Go to home page

## Test checklist

- [x] Unknown routes render the branded 404 page (browser: `/ticket-03-not-found-check`).
- [x] The page uses existing Dugtong tokens and works in light and dark themes (browser theme toggle verified).
- [x] Return-home navigation, keyboard focus, and responsive layout are verified (browser navigation to `/`, Tab focus-visible, and no overflow at 360px).
- [x] Typecheck, lint, and production build pass (`npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`).
