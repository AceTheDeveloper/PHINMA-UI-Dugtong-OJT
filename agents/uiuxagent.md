# UI/UX Agent — Dugtong OJT

> **Role & Boundary Assertion:**
> This agent defines and governs **Neil's exclusive scope: UI / UX ONLY**.
> It ensures that all work performed by Neil (and assisting AI models) focuses strictly on frontend presentation, design tokens, accessibility, and user interaction, without disturbing database schemas, server migrations, authentication rules, or backend business logic.

---

## 1. Identity & Strict Scope

### Neil Strictly OWNS:
- **Design Tokens & Theme:** Light mode and dark mode tokens (`app/globals.css`), zero-flash pre-paint script (`zero-FOUC`), semantic Tailwind tokens matching `AGENTS.md §10`.
- **Component Design & Primitives:** Reusable UI components in `components/ui/` (buttons, badges, modals, cards, tabs, dropdowns, inputs, forms).
- **Navigation & Shell:** Responsive navbar, mobile drawer menu, sticky header with safe-area insets, sidebar, and breadcrumbs.
- **States & Micro-Interactions:** Hover, `:focus-visible`, active, disabled, loading, empty, and error states for all interactive elements.
- **Loading Architecture & Skeletons:** Layout-matching skeleton loaders (zero cumulative layout shift / CLS) for DTR tables, application lists, and dashboards.
- **Micro-Copy & Typography:** Enforcing `AGENTS.md §9` (sentence case everywhere, verb-first buttons like `"Time in"`, `"Reject entry"`, tabular numerals for hours/times).
- **Feedback Surfaces:** Toast notifications, accessible confirmation modals (`<dialog>`), sync/status badges (`Pending`, `Approved`, `Rejected`).
- **Accessibility Baseline:** WCAG 2.2 AA conformance, complete keyboard navigation path, minimum tap targets $\ge 44 \times 44\text{px}$.

### Neil DOES NOT TOUCH (Forbidden Boundaries):
- **Database & Storage:** Do NOT edit Supabase tables, migrations, RLS policies, triggers, or audit rows.
- **Authentication & Secrets:** Do NOT alter Clerk session handling, JWT flows, or service-role keys.
- **Backend Business Rules:** Do NOT modify server-side hour validation, attendance calculations, or role permission tables (`AGENTS.md §4 & §6`).
- **Client Clock:** Never write time calculations on the client (all DTR hours are server-timestamped).

---

## 2. Hard Invariant Rules (`UX-01` to `UX-16`)

- **UX-01 Theme & Tokens:** No hardcoded hex values in component markup. All colors must use semantic tokens (`bg-primary`, `text-ink`, `border-border`). Theme class is set by an inline pre-paint script (zero flash); text contrast $\ge 4.5:1$ in both themes.
- **UX-02 Mobile Navigation:** Mobile menu triggers have `aria-expanded` and `aria-controls`. Body scroll is locked while open; focus trap enabled; Esc and route changes close it; all tap targets $\ge 44 \times 44\text{px}$.
- **UX-03 Sticky Header:** Header uses `position: sticky`, fixed height token, zero layout shift, and `scroll-margin-top` on anchor targets; must never obscure focused elements (WCAG 2.4.11).
- **UX-04 Four Interactive States:** Every button, link, and input must declare `default`, `hover`, `:focus-visible`, and `disabled` states. Hover must be gated by `@media (hover: hover)`.
- **UX-05 Layout-Matching Skeletons:** Skeletons must accurately mirror final content geometry (cards, table rows, KPI stats) rather than generic center spinners. Zero layout shifts. Honors `prefers-reduced-motion`.
- **UX-06 Accessible Expandables:** Expandable logs, FAQs, or student details use native `<details>` or buttons with `aria-expanded` and keyboard navigation.
- **UX-07 Confirmation Modals:** Reserved only for destructive, irreversible, or high-impact actions (e.g., rejecting an application or discarding unsaved journals). Uses accessible `<dialog>` with focus trap; safe action gets default focus; buttons name the action (`"Discard journal"`), never generic `"OK"`.
- **UX-08 Toasts & Notifications:** Toasts use `role="status"` (info/success) or `role="alert"` (error). Info auto-dismisses after 5s; errors persist until dismissed; pauses on hover/focus.
- **UX-09 Custom 404 & Empty States:** Clean 404 and empty state components (e.g., `"No pending applications"` or `"No journal entries for this date"`) that guide the user on what action to take next.
- **UX-10 Tabular Numerals:** All hours, DTR timestamps, timer readouts, and numerical totals must enable `tabular-nums` (`font-variant-numeric: tabular-nums`) to prevent jitter.
- **UX-11 Copy Feedback:** Any copy-to-clipboard action (e.g., student ID, certificate code) provides immediate visible toast feedback and button label swap with `aria-live`.
- **UX-12 Status Surface Consistency:** Status badges (`Pending`, `Approved`, `Rejected`, `Corrected`) use unified semantic pill styling matching `AGENTS.md §10` across Student, Supervisor, and Coordinator views.
- **UX-13 A11y Baseline:** WCAG 2.2 AA compliant, clean tab sequence, proper heading hierarchy (`h1` $\rightarrow$ `h2` $\rightarrow$ `h3`), usable at $320\text{px}$ width on low-end mobile screens.
- **UX-14 The "First 5 Seconds" Rule:** Primary actions on every screen (e.g., `"Time in"` for students, `"Approve all"` for supervisors) must be instantly obvious without scanning a manual.
- **UX-15 Error Empathy:** Error messages explain *what happened*, *why it happened*, and *what to do next*, in one sentence, in plain human language. Never prefix with `"Error:"` or expose raw tech stacks.
- **UX-16 Visual Progress Bar:** Display required OJT hours progress using an accessible visual progress bar showing completed hours vs required target.

---

## 3. UI Pre-Flight Checklist

Before committing any UI change on branch `Neil`:
- [ ] Only UI/UX files were modified (components, styles, layouts, assets).
- [ ] No hardcoded hex colors added (used semantic tokens from `AGENTS.md §10`).
- [ ] All interactive elements have hover, focus-visible, and disabled styles.
- [ ] Skeletons match card/table dimensions (zero layout shift).
- [ ] DTR hours and timestamps have `tabular-nums`.
- [ ] Buttons are verb-first and sentence case (e.g., `"Time in"`, `"Submit journal"`).
- [ ] No console errors or accessibility violations.
- [ ] Tested on mobile view ($320\text{px}$ to $400\text{px}$).

---

## 4. Git Commit Protocol
All commits on branch `Neil` must follow the repository standard:
```bash
git add <ui-files>
git commit -m "ticket-XX: <short UI description>"
git push origin Neil
```

