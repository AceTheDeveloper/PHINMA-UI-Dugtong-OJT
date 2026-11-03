# DESIGN.md: Dugtong OJT UI/UX Architecture & System Guide

> **Author & Owner:** Neil (UI / UX Engineer)  
> **Repository:** [PHINMA-UI-Dugtong-OJT](https://github.com/AceTheDeveloper/PHINMA-UI-Dugtong-OJT.git) (Branch: `Neil`)  
> **Design Pedigree:** Synthesized from **Cortex Procedural Invariants** and **Portfolio Exploded Architecture** for **PHINMA University of Iloilo CITE**.

---

## 1. Core Philosophy & Design Direction

### The "Connected" Theme
The Dugtong mark consists of two linked rounded squares and a teal accent dot. Connection and visible progress are the soul of the product:
1. **The Signature "Hours Chain":**
   * A horizontal track of linked rounded squares, with **one link per 40 approved hours**.
   * Filled links use `--primary` (#2563eb in light, #60a5fa in dark).
   * The active in-progress link displays a glowing teal dot (`--teal` / `#086a6a`).
   * **Rule of Boldness:** Spend visual boldness on the Hours Chain and key progress numbers; keep every other surface quiet, calm, and readable.
2. **Mobile-First for Students:**
   * Students clock in from low-end Android and iOS smartphones on cellular data.
   * Student navigation is an accessible **bottom tab bar** on screens $< 640\text{px}$.
   * The daily primary action (**"Time in"** or **"Time out"**) must be reachable in **one tap** within the first 5 seconds of opening the app.
   * All interactive touch targets are strictly $\ge 44 \times 44\text{px}$.
3. **One Focal Point Per Screen:**
   * Never stack identical cards endlessly.
   * Every screen has one dominant focal panel (the primary metric or active daily action), followed by divided rows and structured lists.

---

## 2. What I Design (The UI Scope Matrix)

| Surface | What I Design | Key UX Invariant |
|---|---|---|
| **Student DTR Portal** | Time in/out card, daily journal editor, break duration field, hours chain progress bar, past entries list. | One-tap daily action, `tabular-nums` for timestamps, bottom tabs on mobile. |
| **Supervisor Deck** | Pending log queue, student deployment cards, inline rejection modal with mandatory reason, bulk-approve toolbar. | Action-named confirmation buttons (`"Approve 8 entries"`, `"Reject entry"`), zero fake optimistic saves. |
| **Coordinator Console** | BSIT student roster, CSV import preview modal, company listings grid, stale entry alerts, hours export toolbar. | Debounced search (300ms), sortable tabular columns, sticky header with safe-area insets. |
| **Component Kit** | Reusable buttons, badges, modals, toast notifications, inputs, dropdowns, and skeleton loaders. | 4 states on every element (`default`, `hover`, `:focus-visible`, `disabled`), semantic tokens only. |

---

## 3. Strict Boundary Rules (No Overlaps)

To maintain absolute architectural integrity, Neil's scope is strictly separated from backend and server logic:

### Strictly OWNS (Neil):
* Visual presentation, layout shells, and responsive grid geometry ($320\text{px}$ to $4\text{K}$).
* Design tokens (`globals.css`), CSS variables, and light/dark theme switching without FOUC flashes.
* Component states (`hover`, `focus-visible`, `active`, `disabled`, `loading`, `empty`, `error`).
* Layout-matching skeleton loaders (zero cumulative layout shift / CLS).
* Client-side input debouncing (search, filters, sort orders) and optimistic tab transitions.
* Micro-copy compliance (sentence case, verb-first buttons, error empathy).
* Accessibility compliance (WCAG 2.2 AA, keyboard focus traps, ARIA labels).

### NEVER TOUCHES (Forbidden Backend Boundaries):
* **No Database/RLS edits:** Do not create or edit Supabase tables, migrations, RLS policies, triggers, or audit rows.
* **No Auth/Secrets edits:** Do not alter Clerk session tokens, webhook secrets, or service-role keys.
* **No Client Time Calculations:** Time in, time out, and total hours are **authoritative server timestamps** in `Asia/Manila`. The UI never accepts or computes clock timestamps from the user's client device clock.
* **No Table Writes from Client:** All mutations execute through validated server actions or API endpoints.

---

## 4. What I Use (Tech Stack & Tooling)

* **Framework:** Next.js 16.4+ (App Router), React 19, TypeScript.
* **Styling Engine:** Tailwind CSS v4 using CSS Custom Properties (`@import "tailwindcss"`).
* **Component Primitives:** shadcn/ui (radix-ui primitives customized to match PHINMA tokens).
* **Typography:** Geist Sans (body text $\ge 14\text{px}$, page titles $\ge 28\text{px}$, notes $12\text{px}$), Geist Mono (code & IDs).
* **Tabular Numerals:** Always enable `tabular-nums` (`font-variant-numeric: tabular-nums`) on all hours, times, and counters.
* **Icons:** Lucide React (clean, stroke width 1.75px–2px, never colored as the sole indicator of meaning).
* **Micro-Motion:** Minimal, intentional Framer Motion / CSS transitions. Maximum **one deliberate animation per page** (e.g. the hours chain filling on load); strictly honors `prefers-reduced-motion`.

---

## 5. Performance, Debouncing & Instant Transitions

Derived from the battle-tested loading architecture of the Portfolio & Cortex:

### 1. Debounced Search & Filtering
When searching student rosters, listings, or past DTR entries:
* Wrap input queries in a `useDebounce` hook with a **250ms–300ms window**.
* Do not trigger network requests or expensive re-renders on every keystroke.
* Show an inline search spinner/pulse inside the input field while awaiting debounced query results.

```tsx
// Standard Debounce Hook Pattern
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}
```

### 2. Instant Tab Transitions (`useTransition`)
* Tab switches between `All`, `Pending`, `Approved`, and `Rejected` must highlight the active pill **immediately ($< 10\text{ms}$)** using React 19 `startTransition`.
* Avoid blank flashes or full-page loaders during tab switches.
* The header and tab bar remain static; only the table body renders a skeleton fallback beneath `<Suspense>`.

### 3. Zero-CLS Layout-Matching Skeletons
* Never use full-page spinners or arbitrary sized skeleton blocks.
* Skeletons must mirror the exact dimensions of final components:
  * **KPI Card Skeleton:** Height $104\text{px}$, rounded-2xl, metric placeholder.
  * **Table Row Skeleton:** Height $48\text{px}$ per row, matching column widths with subtle pulse (`bg-muted/70`).
  * **Hours Chain Skeleton:** Track placeholder with 12 linked squares.

---

## 6. Micro-Copy & Interaction Rules

Following `AGENTS.md §9`:
* **Sentence Case Everywhere:** Capitalize only the first letter and proper nouns (`"Daily attendance log"`, not `"Daily Attendance Log"`). Never use all-caps tracked badges above headings.
* **Verb-First Buttons:** Action buttons must declare the action directly:
  * ✅ `"Time in"` | `"Time out"` | `"Submit journal"` | `"Approve all"` | `"Reject entry"` | `"Discard draft"`
  * ❌ `"OK"` | `"Click here"` | `"Submit"` | `"Continue"`
* **Forbidden Words:**
  * Never use `"successfully"` (`"Journal submitted"`, not `"Journal successfully submitted"`).
  * Never use `"please"` (`"Select a company"`, not `"Please select a company"`).
  * Never prefix error messages with `"Error:"`.
* **Error Empathy (`UX-15`):**
  * Error messages state *what happened*, *why*, and *what to do next*, in one plain-language sentence.
  * Example: `"You have already timed in for today. Time out before recording a new shift."`

---

## 7. The Design Tokens (Light & Dark Mode)

All colors must be referenced through these semantic tokens. **No raw hex codes in components.**

```css
:root {
  /* Foundation */
  --primary: #2563eb;
  --primary-hover: #1d4ed8;
  --primary-tint: #e6eefe;
  --primary-track: #d4e0fb;
  --ink: #0f172a;
  --muted: #596579;
  --faint: #6b7686;
  --disabled: #98a2b3;
  --border: #eceef2;
  --border-strong: #d5dae2;
  --surface: #f5f7fa;
  --page-wash: #f8fafe;
  --focus-ring: rgb(37 99 235 / 0.4);

  /* Success */
  --success-tint: #d9f5ea;
  --success-border: #a8e3cb;
  --success: #087a55;
  --success-hover: #066245;
  --success-text: #087a55;

  /* Warning */
  --warning-tint: #fef3c7;
  --warning-border: #f6d776;
  --warning: #b45309;
  --warning-hover: #92400e;
  --warning-text: #92400e;

  /* Error */
  --error-tint: #fee2e2;
  --error-border: #fca5a5;
  --error: #dc2626;
  --error-hover: #b91c1c;
  --error-text: #dc2626;

  /* Info & Teal */
  --info: #2563eb;
  --info-tint: #e6eefe;
  --info-text: #1e40af;
  --teal: #086a6a;
  --teal-tint: #ddf4f4;
  --teal-border: #a9dcdc;

  /* Background & Card Mappings */
  --background: #f8fafe;
  --foreground: #0f172a;
  --card: #ffffff;
  --card-foreground: #0f172a;
}

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
  --success-text: #6ee7b7;

  --warning-tint: #3a2d12;
  --warning-border: #7a5a1c;
  --warning: #b45309;
  --warning-text: #fcd34d;

  --error-tint: #3b1d25;
  --error-border: #7c2c3b;
  --error: #dc2626;
  --error-text: #fca5a5;

  --background: #0b1220;
  --foreground: #f1f5f9;
  --card: #152238;
  --card-foreground: #f1f5f9;
}
```

---

## 8. Definition of Done for Any UI Ticket

Before pushing any ticket to branch `Neil`:
- [ ] Screen matches the "Connected" theme and has one clear focal point.
- [ ] Tested at **390px (mobile)** and **1440px (desktop)**: zero horizontal scrolling.
- [ ] Tested in both **Light and Dark mode** (contrast $\ge 4.5:1$).
- [ ] All interactive touch targets are $\ge 44 \times 44\text{px}$.
- [ ] Every interactive element has all 4 states (`default`, `hover`, `:focus-visible`, `disabled`).
- [ ] Skeleton loaders match the final layout dimensions (zero CLS).
- [ ] All hours, times, and numbers use `.tabular-nums`.
- [ ] Buttons are verb-first and sentence case.
- [ ] No raw hex codes used in markup.
- [ ] TypeScript check (`npx tsc --noEmit`) passes with 0 errors.
- [ ] Commit format: `ticket-XX: <short UI description>`.
