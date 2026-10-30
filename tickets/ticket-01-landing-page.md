# ticket-01: Landing page

- Type: feature
- Assignee: Ace
- Status: done
- Mockup: None. This ticket is the design brief. Do not invent anything beyond it.
- AGENTS.md sections: 3 (stack), 7 (security), 9 (UI and copy), 10 (design tokens), 11 (fonts), 13 and 14 (AI rules)

## What and why

Build the public landing page at `/` for Dugtong OJT. It explains in plain language that Dugtong replaces the paper DTR: students log hours and a daily journal, supervisors approve them daily, coordinators see everyone's progress. It must look modern, calm, and trustworthy, and must not look like a generic AI-generated template. This page is only the landing page. Nothing else is built in this ticket.

## Owner decisions (confirm before the plan is approved)

- Logo: the owner provides the logo file in `public/`. If it is missing, ask. Do not draw or recreate a logo. A plain text wordmark "Dugtong" in the heading font is allowed only as a temporary placeholder.
- Fonts: Plus Jakarta Sans (headings 700 and 800), Inter (body 400 and 600), JetBrains Mono (times in sample UI only).
- Sign in links go to `/sign-in`. That route belongs to a later auth ticket. Do not build auth here.
- The landing page is the one public page. It contains no OJT data. The owner adds this exception to `AGENTS.md` section 7 before work starts.
- Light mode only. Dark mode is not defined yet.

## In scope

- The route `/` with the sections in the order below.
- Sample product UI built with Tailwind CSS utilities and HTML (no screenshots, no images), using fictional sample data.
- Use shadcn/ui primitives for standard controls where appropriate.
- Responsive layout, accessibility basics, light scroll reveal.

## Out of scope

- Sign in page, Clerk setup, any auth logic.
- Privacy and terms pages (do not link to pages that do not exist).
- Dark mode, analytics, cookie banner, blog, other pages, translations.
- Listings or any public data. No "browse openings" and no "create account" (sign-up is invitation-only).

## Page structure (in this order)

1. **Header:** logo, links "How it works" and "Who it's for", and a "Sign in" button.
2. **Hero:** left-aligned text, product visual on the right.
3. **How it works:** three steps.
4. **Who it's for:** students, supervisors, coordinators.
5. **Records you can rely on:** plain list.
6. **Final call to action.**
7. **Footer.**

## Approved copy

Use this copy exactly. Do not write other copy. If you need a new line of text, add it to "Open questions".

**Hero**

- H1: Replace the paper DTR.
- Subtext: Students log their hours and a short daily journal. Supervisors approve them the same day. Coordinators see every student's progress without chasing signatures.
- Primary button: Sign in
- Secondary link: See how it works
- Small line under the buttons: Accounts are created by your school.
- Caption under the sample UI: Sample data

**How it works** (heading: From a day's work to approved hours)

1. Log the day. Students time in, time out, and write a short journal. The time comes from the server, not the phone.
2. Approve it daily. The company supervisor approves the entry, rejects it with a reason, or corrects the times.
3. Hours add up. Only approved hours count. When the required hours are met, the supervisor submits an evaluation and the certification is generated.

**Who it's for**

- Students. Heading: See your hours at a glance. Text: Track approved hours against your requirement, read your journal history, and get your certification when you finish.
- Supervisors. Heading: Approve in one pass. Text: Review the day's entries together, approve them in bulk, and evaluate students when their hours are complete.
- Coordinators. Heading: Know where everyone stands. Text: See every student's progress, spot approvals that are stuck, and export records and printable DTRs.

**Records you can rely on** (heading: Records you can rely on)

- Approved entries are locked. Reopening one is recorded.
- Every approval, correction, and rejection is kept with who made it and when.
- Students see only their own hours.
- Files stay private.
- Built to follow the Data Privacy Act of 2012.

**Final call to action**

- Heading: Already have an invitation?
- Text: Sign in with the email your school has on file.
- Button: Sign in

**Footer**

- Wordmark or logo, a "Sign in" link, and "2026 Dugtong OJT".

## Design brief

**Feel:** calm, confident, institutional but modern. Think of a well-made fintech or government-tech product page, not a startup template. The existing landing page (https://dugtong-ojt.vercel.app/) is a reference for feel only. Do not copy its copy, its claims, or its sample school.

**Colors:** only the tokens in `AGENTS.md` section 10, defined once as CSS variables. No raw hex values in components. Primary blue on at most one filled button per screen. Teal is the secondary accent. Status colors appear only inside the sample UI. The only background effect allowed is the subtle `--page-wash` fading to white behind the hero. A dark band using `--ink` is allowed for the final call to action.

**Typography:** headings in Plus Jakarta Sans with slightly tight tracking (about -0.02em), fluid sizes with `clamp()`, hero heading about 56 to 72px on desktop. Body in Inter at 17 to 18px with 1.6 line height and a line length near 62 characters. JetBrains Mono only for times and IDs inside the sample UI. Tabular numerals on every number. Load fonts with `next/font` and system fallbacks.

**Layout:**

- Content max width 1200px, side padding 24px on mobile and 32px on desktop. Section spacing about 72px on mobile and 120px on desktop. Use an 8px spacing scale.
- Hero is two columns from 1024px up (text about 5/12, visual about 7/12), stacked on mobile with the text first. Left-aligned. Do not center everything.
- Hero visual: a coordinator dashboard card overlapped by a phone frame showing the student's daily log (time in, "Pending approval", hours progress). Built from real component styles and the tokens. Fictional names only. Use hairline borders, and at most one soft shadow on the whole page (the phone).
- How it works: three steps on a horizontal rail with numbered markers on desktop, vertical on mobile. Each step has a small UI fragment (a time-in chip, an approval row, a progress bar). Do not use icons in colored circles.
- Who it's for: alternating two-column rows (text on one side, a UI fragment on the other). Do not use three identical cards.
- Records you can rely on: a two-column list on the `--surface` background with small check marks, no large icons.
- Corners: 12px for cards, 8px for controls, used consistently.

**Motion:** hover and focus transitions at about 150ms. Scroll reveal is a fade and an 8 to 12px rise over about 300ms, once per element. No parallax, autoplay, cursor effects, or animation libraries. Respect `prefers-reduced-motion`.

**Icons:** a small set from `lucide-react` (check, arrow-right), six at most.

**Images:** none except the logo. No stock photos, no AI-generated images, no 3D renders, no illustration packs.

## Do not (anti-slop checklist)

- No purple, pink, or neon gradients. No gradient text.
- No glassmorphism, backdrop blur, glows, blurred blobs or orbs, dot grids, or noise textures.
- No emoji.
- No fake statistics, counters, testimonials, star ratings, "trusted by" logo rows, or awards.
- No unverifiable claims ("verified", "bank-grade", "#1", "enterprise-ready").
- No pill badge above the hero heading.
- No row of three identical feature cards as the main structure.
- No centered-everything layout.
- No buzzwords: revolutionize, seamless, unlock, supercharge, powerful, all-in-one, next-generation, effortless, AI-powered.
- No exclamation marks, no "please", no "click here".
- No lorem ipsum or leftover placeholder text.
- No heavy drop shadows.

## Acceptance criteria

- [x] `/` renders the seven sections in the order above, using only the approved copy.
- [x] Colors come only from the section 10 tokens, defined once as CSS variables, with no raw hex in components.
- [x] Fonts load through `next/font` with fallbacks, and numbers use tabular numerals.
- [x] Sample UI uses fictional names and is labeled "Sample data". No real school, student, or company appears.
- [x] Every "Sign in" button links to `/sign-in`. There is no "Create account" anywhere.
- [x] No item from the anti-slop checklist appears.
- [x] Works from 360px to 1440px with no horizontal scroll. Body text is at least 16px. Tap targets are at least 44px.
- [x] One `h1`, a logical heading order, visible focus styles, full keyboard navigation, a skip link, and AA contrast.
- [x] `prefers-reduced-motion` is honored.
- [x] Mostly server components, no animation library, and no unused client JavaScript.
- [x] Page has a title, a meta description, and `lang="en"`.

## Test checklist

Tested by AI (tick only after actually running it, and note the command and result):

- [x] `npx.cmd tsc --noEmit; if ($?) { npm.cmd run lint; if ($?) { npm.cmd run build } }` — passed.
- [x] Screenshots at 375, 768, and 1440 px reviewed; Playwright reported no horizontal overflow at 360, 375, 768, or 1440 px.
- [x] Accessibility smoke check — Playwright confirmed the skip link receives visible keyboard focus, reduced-motion styles keep content visible, and seven representative text/background pairs meet 4.5:1 contrast. Axe/Lighthouse was unavailable.
- [x] Each acceptance criterion checked: reviewed section order/copy and visual anti-slop checklist; verified one `h1`, four `/sign-in` links, `lang="en"`, page title, and responsive widths; typecheck, lint, and build passed.

Tested by a human:

- [ ] Viewed on a desktop browser and a real phone, copy read in full, anti-slop checklist reviewed (who and when: ___)

## Plan (AI fills in before coding)

- Replace the starter page with the seven approved landing-page sections and fictional HTML/CSS sample UI.
- Define the section 10 color tokens once in global CSS; load the approved fonts with `next/font`, set metadata and `lang="en"`, and add responsive layout, focus, reduced-motion, and skip-link support.
- Add only the small client-side behavior needed for one-time scroll reveal; keep the page and sample UI server-rendered.
- Add `lucide-react` for the specified check and arrow icons; do not add animation dependencies.
- Prepare the owner-provided icon logo as a transparent, high-resolution PNG for the light page without changing its artwork.
- Add the explicit public-page and non-OJT branding-asset exception to AGENTS.md section 7, leaving OJT data and storage protected by the existing login rule.
- Run typecheck, lint, and production build; review screenshots at 375, 768, and 1440px and check the acceptance criteria.
- [x] Plan approved by a human

## Follow-up request: Tailwind and shadcn styling

### Plan

- Replace the landing page's bespoke component styling with Tailwind utility classes while preserving the approved page structure, copy, responsive behavior, and visual design.
- Initialize shadcn/ui using the existing Tailwind v4 setup and use its Button primitive for the shared sign-in controls where appropriate.
- Keep global CSS limited to the approved color-token variables, base/reset rules, font setup, and the narrowly scoped reveal behavior.
- Run typecheck, lint, production build, and the existing responsive browser checks after the refactor.

- [x] Follow-up plan approved by a human

### Follow-up result

- Replaced the page's bespoke layout and component styles with Tailwind utilities; global CSS now contains token mappings, base variables, and scroll-reveal rules.
- Initialized shadcn/ui and used its Button primitive for the sign-in links.
- Removed the unused animation stylesheet; `prefers-reduced-motion` remains supported.
- [x] `npx.cmd tsc --noEmit; if ($?) { npm.cmd run lint; if ($?) { npm.cmd run build } }` — passed.
- [x] Playwright reviewed screenshots at 375, 768, and 1440px and reported no overflow at 360, 375, 768, or 1440px.
- [x] Browser smoke checks confirmed visible keyboard focus, link semantics on sign-in actions, and reduced-motion behavior.

## Open questions (AI writes here instead of guessing)

-

## Suggested new tickets (ideas found along the way, not built)

-
