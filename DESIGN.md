# DESIGN.md: Dugtong OJT UI/UX Architecture & System Guide

> **Author & Owner:** Neil (UI / UX Engineer)  
> **Repository:** [PHINMA-UI-Dugtong-OJT](https://github.com/AceTheDeveloper/PHINMA-UI-Dugtong-OJT.git) (Branch: `Neil`)  
> **Design Pedigree:** Synthesized from **Cortex Procedural Invariants** and **Neil's Portfolio Exploded Architecture** for **PHINMA University of Iloilo CITE**.

---

## 1. Core Philosophy & Design Direction

### The "Connected" Theme
The Dugtong mark consists of two linked rounded squares and a teal accent dot. Connection and visible progress are the soul of the product:
1. **The Signature "Hours Chain":**
   * A horizontal track of linked rounded squares, with **one link per 40 approved hours**.
   * Filled links use `--primary` (`#2255f2` in light, `#6e93ff` in dark).
   * The active in-progress link displays a glowing teal dot (`--teal` / `#086a6a` in light, `#5eead4` in dark).
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

## 2. Neil's Design Techniques: Cortex & Portfolio Methodologies

The Dugtong OJT interface is engineered using the exact aesthetic, telemetry, and spatial techniques refined across **Neil's Portfolio** and **Cortex Systems**:

### 1. The Architectural Bento Grid (Asymmetrical Weighting)
* **7:5 Column Tension:** Rather than standard symmetric grids, layouts pair a high-impact typographic statement on the left ($60\%\text{–}65\%$ width) with an active, functional interactive artifact on the right ($35\%\text{–}40\%$ width).
* **Surface Hierarchy:** Page wash background (`--page-wash`) creates depth beneath elevated white/navy cards (`--card`), bounded by delicate 1px border framing (`--border`) and subtle hairline shadows (`--elevation-panel`).

### 2. The System Status HUD Strip
* Modeled directly after technical command hubs and Cortex instrumentation:
  * **Live Status Node:** A pulsing emerald status orb (`bg-success animate-pulse`) anchored to a monospace category label (`font-mono text-[11px] font-bold`).
  * **Authoritative Telemetry:** Clear display of authoritative server timezone (`Asia/Manila Server Authoritative`), ping latency (`24ms Latency`), and protocol security (`SSL Guarded`).
  * Monospaced, high-contrast, technical header framing that grounds the page with institutional credibility.

### 3. The Interactive Device Container (Mini-App / Smartphone Simulator)
* Instead of presenting static screenshots or flat illustrations, live systems are previewed through an **interactive, tactile micro-app experience**:
  * **Mathematically Aligned Dot Grid:** A subtle background grid (`radial-gradient` dot matrix) centered inside the device frame, providing depth without distraction.
  * **Device Bezel Framing:** Rounded-3xl borders, status indicator bar (Wi-Fi, 5G, Battery, and Clock), and home indicator bar at the bottom.
  * **Live Interactive State:** Users can tap the clock-in button to simulate state transitions, toggle supervisor approvals, and watch dynamic percentage shifts in real time.
  * **Embedded Hours Chain:** The device surfaces the signature progress chain right in the student's active shift card.

### 4. Seamless Dual-Track Infinite Marquee
* A continuous, horizontally streaming industry partner ticker:
  * **Alpha Gradient Masking:** Uses CSS `-webkit-mask-image: linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)` to eliminate harsh edge cutoffs and create an infinite optical bleed.
  * **Dual Stream Clones:** The DOM renders two duplicate tracks within a single flex container powered by a silky-smooth `@keyframes marquee` translation (`translateX(-50%)`), completely eliminating stutter or re-trigger jumps.
  * Zero scrollbars (`no-scrollbar`) and non-blocking interaction.

### 5. Glowing SVG Telemetry Curves (Pure Code Visualization)
* Clean vector telemetry without the bundle weight of bloated third-party charting libraries:
  * Handcrafted cubic Bezier curves (`M ... C ...`) plotting cumulative student hours vs. target milestones.
  * Ambient vertical gradient fills fading to `opacity: 0` using SVG `<defs>` and `<linearGradient>`.
  * Interactive hover anchors that reveal pinpoint timestamp and delta tooltips with micro-transitions.

### 6. Tabular Typographic Rigor
* All numbers, times, percentages, and IDs are enforced with `font-variant-numeric: tabular-nums` (`tabular-nums`).
* Eliminates jitter and horizontal layout shift when counters tick or values update.
* Monospace accents (`font-mono`) reserved exclusively for authoritative codes, coordinates, and system timestamps.

---

## 3. What We Built (Implementation Record)

The following core modules and screens have been designed and implemented on branch `Neil`:

### 1. The Architectural Bento Hero (`components/landing/OjtHero.tsx`)
* **Top Status HUD:** Live operational indicator with Asia/Manila server authoritative notice and latency telemetry.
* **Left Bento Panel:** High-impact editorial typography, BSIT program pilot tag, campus coordinates badge (`10.7027° N, 122.5694° E`), and primary portal CTAs.
* **Right Interactive Smartphone Device:**
  * Live dynamic toggle for **Clocked In / Clocked Out** shift states.
  * Signature **Approved Hours Box** with live visual Hours Chain rendering.
  * Supervisor approval queue with toggleable student approvals (`Ana S.`, `Ben M.`, `Cara D.`).
  * Instant auto-calculation of progress toward the 300.0-hour course requirement.
* **Infinite Industry Marquee:** Dual-track streaming strip of official CITE accredited industry partners with dedicated category badges and semantic icons: **RELX** (`Globe`), **iXL** (`Sparkles`), **Callbox** (`Headset`), **iGift** (`Gift`), **DICT** (`RadioTower`), **F&C Jewelry** (`Gem`), **PESO Iloilo City** (`Briefcase`), **PESO Province of Iloilo** (`Landmark`), and **Inspiro** (`Users`).

### 2. Minimalist Telemetry & SVG Curve Charts (`components/landing/OjtTelemetryData.tsx`)
* High-precision trajectory chart graphing cumulative cohort hours against the required milestone.
* Ambient cyan/blue glow gradients with interactive point tooltips.
* Multi-metric telemetry cards: Active Deployments, Velocity (Hours/Week), Supervisor Sign-off Rate (99.2%), and Stale Log Rate (< 0.8%).

### 3. Interactive DTR Verification Pipeline (`components/DtrPipelineBreakdown.tsx`)
* Step-by-step state machine visualization covering the full daily lifecycle:
  1. **Clock In (Open):** Client triggers server clock capture (device time untrusted).
  2. **Shift Completion & Daily Journal (Pending):** Student inputs tasks and optional break deduction.
  3. **Supervisor Sign-off:** Daily approval, correction with audit logging, or rejection with mandatory reason.
  4. **Lock & Audit:** Automatic accumulation into graduation requirements; records locked against client manipulation.
* Interactive simulator allowing users to test shift workflows directly in the browser.

### 4. Student & Coordinator Dashboard Deck (`components/dashboard/OjtDashboardView.tsx`)
* Dual-persona switcher:
  * **Student View:** Active deployment banner, today's shift card, one-tap daily action, live journal editor, and hours breakdown.
  * **Coordinator Console:** BSIT student roster, quick filtering by deployment status, stale entry alerts, and export triggers.
* Full Hours Chain integration with multi-segment visual tracking.

---

## 4. What I Design (The UI Scope Matrix)

| Surface | What I Design | Key UX Invariant |
|---|---|---|
| **Student DTR Portal** | Time in/out card, daily journal editor, break duration field, hours chain progress bar, past entries list. | One-tap daily action, `tabular-nums` for timestamps, bottom tabs on mobile. |
| **Supervisor Deck** | Pending log queue, student deployment cards, inline rejection modal with mandatory reason, bulk-approve toolbar. | Action-named confirmation buttons (`"Approve 8 entries"`, `"Reject entry"`), zero fake optimistic saves. |
| **Coordinator Console** | BSIT student roster, CSV import preview modal, company listings grid, stale entry alerts, hours export toolbar. | Debounced search (300ms), sortable tabular columns, sticky header with safe-area insets. |
| **Component Kit** | Reusable buttons, badges, modals, toast notifications, inputs, dropdowns, and skeleton loaders. | 4 states on every element (`default`, `hover`, `:focus-visible`, `disabled`), semantic tokens only. |

---

## 5. Strict Boundary Rules (No Overlaps)

To maintain absolute architectural integrity, Neil's scope is strictly separated from backend and server logic:

### Strictly OWNS (Neil):
* Visual presentation, layout shells, and responsive grid geometry ($320\text{px}$ to $4\text{K}$).
* Design tokens (`globals.css`), CSS variables, and light/dark theme switching without FOUC flashes.
* Component states (`hover`, `focus-visible`, `active`, `disabled`, `loading`, `empty`, `error`).
* Layout-matching skeleton loaders (zero cumulative layout shift / CLS).
* Client-side input debouncing (search, filters, sort orders) and optimistic tab transitions.
* Micro-copy compliance (sentence case, verb-first buttons, error empathy).
* Accessibility compliance (WCAG 2.2 AA, keyboard focus traps, ARIA labels, `suppressHydrationWarning` on extension-vulnerable boundaries).

### NEVER TOUCHES (Forbidden Backend Boundaries):
* **No Database/RLS edits:** Do not create or edit Supabase tables, migrations, RLS policies, triggers, or audit rows.
* **No Auth/Secrets edits:** Do not alter Clerk session tokens, webhook secrets, or service-role keys.
* **No Client Time Calculations:** Time in, time out, and total hours are **authoritative server timestamps** in `Asia/Manila`. The UI never accepts or computes clock timestamps from the user's client device clock.
* **No Table Writes from Client:** All mutations execute through validated server actions or API endpoints.

---

## 6. What I Use (Tech Stack, Tools & Libraries)

* **Framework:** Next.js 16.4+ (Turbopack, App Router), React 19, TypeScript (strict, zero `any`).
* **Styling Engine:** Tailwind CSS v4 using CSS Custom Properties and `@theme inline` mappings.
* **Component Primitives:** shadcn/ui primitives customized to PHINMA design tokens.
* **Typography:**
  * **Headings & Body:** IBM Plex Sans (`400`, `500`, `600`, `700`) with system fallbacks.
  * **Code & Telemetry:** IBM Plex Mono (`400`, `500`, `600`) for timestamps, codes, coordinates, and latency.
* **Tabular Numerals:** Always enable `tabular-nums` (`font-variant-numeric: tabular-nums`) across all numerical metrics.
* **Icons:** Lucide React (stroke width 1.75px–2px, semantically paired with text labels).
* **Visuals & Charts:** Pure SVG vector graphics with linear gradients; zero external charting libraries for minimal footprint.
* **Micro-Motion:** Custom CSS keyframes (`@keyframes dg-bob`, `dg-tilt`, `dg-blink`, `dg-link-in`, `animate-marquee`); always gated behind `@media (prefers-reduced-motion: no-preference)`.

---

## 7. Performance, Debouncing & Instant Transitions

Derived from the battle-tested loading architecture of the Portfolio & Cortex:

### 1. Debounced Search & Filtering
When searching student rosters, listings, or past DTR entries:
* Wrap input queries in a `useDebounce` hook with a **250ms–300ms window**.
* Do not trigger network requests or expensive re-renders on every keystroke.
* Show an inline search spinner/pulse inside the input field while awaiting debounced query results.

```tsx
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
* Tab switches between `All`, `Pending`, `Approved`, and `Rejected` highlight the active pill **immediately ($< 10\text{ms}$)** using React 19 `startTransition`.
* Avoid blank flashes or full-page loaders during tab switches.
* The header and tab bar remain static; only the table body renders a skeleton fallback beneath `<Suspense>`.

### 3. Zero-CLS Layout-Matching Skeletons
* Never use full-page spinners or arbitrary sized skeleton blocks.
* Skeletons must mirror the exact dimensions of final components:
  * **KPI Card Skeleton:** Height $104\text{px}$, rounded-2xl, metric placeholder.
  * **Table Row Skeleton:** Height $48\text{px}$ per row, matching column widths with subtle pulse (`bg-muted/70`).
  * **Hours Chain Skeleton:** Track placeholder with 12 linked squares.

---

## 8. Micro-Copy & Interaction Rules

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

## 9. The Semantic Design Tokens

All colors must be referenced through these semantic tokens. **No raw hex codes in components.**

```css
:root {
  /* Foundation */
  --primary: #2255f2;
  --primary-hover: #1a45cc;
  --primary-tint: #e8eefe;
  --primary-track: #d3dffb;
  --ink: #0c1a33;
  --muted: #4a5876;
  --faint: #5c6a85;
  --disabled: #9aa6bd;
  --border: #e1e6f0;
  --border-strong: #c9d1e0;
  --surface: #eff2f8;
  --page-wash: #f4f6fb;
  --focus-ring: rgb(34 85 242 / 0.4);

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
  --error-text: #b91c1c;

  /* Info & Teal */
  --info: #2255f2;
  --info-tint: #e8eefe;
  --info-text: #1a45cc;
  --teal: #086a6a;
  --teal-tint: #ddf4f4;
  --teal-border: #a9dcdc;
  --teal-text: #086a6a;

  /* Background & Card Mappings */
  --background: #f4f6fb;
  --foreground: #0c1a33;
  --card: #ffffff;
  --card-foreground: #0c1a33;
}

.dark {
  --primary: #6e93ff;
  --primary-hover: #93b0ff;
  --primary-tint: #16254a;
  --primary-track: #22386b;
  --ink: #eaf0fb;
  --muted: #a9b6cf;
  --faint: #94a3bf;
  --disabled: #5d6b86;
  --border: #1f2d4b;
  --border-strong: #324468;
  --surface: #121e38;
  --page-wash: #0a1224;
  --focus-ring: rgb(110 147 255 / 0.45);

  --success-tint: #0f3329;
  --success-border: #1f6048;
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

  --teal-tint: #0f3536;
  --teal-border: #276466;
  --teal: #086a6a;
  --teal-text: #5eead4;
  --teal-bright: #2dd4bf;

  --background: #0a1224;
  --foreground: #eaf0fb;
  --card: #101b33;
  --card-foreground: #eaf0fb;
}
```

---

## 10. Definition of Done for Any UI Ticket

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
- [ ] Test suite (`npm test`) passes.
- [ ] Commit format: `feat(...)` / `fix(...)` / `ticket-XX: <short UI description>`.
