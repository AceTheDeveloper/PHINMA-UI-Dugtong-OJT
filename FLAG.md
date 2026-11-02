# Project Flags & Concerns (FLAG.md)

This file tracks open questions, architectural concerns, blockers, and items that need human review or confirmation from the Lead Dev, PM, or school coordinator.

## 📌 Status Legend
- 🔴 **[BLOCKED]** — Work cannot proceed until this is answered.
- 🟡 **[FOR REVIEW]** — Implemented or drafted, but requires review/approval.
- 🟢 **[RESOLVED]** — Addressed and resolved in code or specifications.

---

## 📝 Active Concerns

### [FLAG-02] The DTR PDF is kept minimal on purpose
- **Date Added:** 2026-11-03
- **Branch / Ticket:** `ace` / `ticket-27` (exports)
- **Status:** 🟡 [FOR REVIEW]
- **Concern / Question:**
  - For the first version the printable DTR shows only the student's name, the time entries (date, time in, time out, hours), and the supervisor's name (decided by the Lead Dev, 2026-11-03: "for now"). As built in ticket-27 it also shows the student number next to the name (two students can share a name), a plain total of the approved hours at the end, and page numbers.
  - It is not yet what a school would normally file. Decide with the coordinator what else it needs.
- **Impact / Context:**
  - Left out on purpose, to add once the school says what it wants: signature lines (student, supervisor, coordinator), a header with the school, course and company, a break column, the total against the required hours, the journal text, and the date it was printed.
  - Only approved entries are listed (only they count toward hours); pending ones are not shown.
  - Code: `lib/dtr/pdf.ts` (the page), `lib/dtr/queries.ts` (what it reads), `app/dtr/[deployment]/pdf/route.ts` (who may have it).
  - The supervisor's name is the supervisor(s) who approved the entries; with none approved yet it is the company's owner.
- **Resolution / Decision:**
  - *(open)*

---

## ✅ Resolved Flags

### [FLAG-01] Dedicated Roster Import for Platform Admin
- **Date Added:** 2026-11-02
- **Date Resolved:** 2026-11-02
- **Branch / Ticket:** `josiah` / `FLAG-01`
- **Status:** 🟢 [RESOLVED]
- **Concern / Question:**
  - Lead Dev (Arwin) noted that Platform Admin should eventually have its own dedicated roster import screen/endpoint instead of reusing the `/coordinator/roster` endpoint (*"dapat may kaugalingon sya nga import"*, *"Huo, pro karon lng"*).
  - The initial implementation shared `/coordinator/roster` and dynamically swapped `<AdminSidebar />` for admins inside `CoordinatorLayout`.
- **Impact / Context:**
  - Coupled Platform Admin navigation to the `/coordinator/*` route tree and introduced dynamic sidebar switching logic in `CoordinatorLayout`.
- **Resolution / Decision:**
  - Implemented Option B:
    1. Created dedicated `/admin/roster` page (`app/(app)/admin/roster/page.tsx`) protected by `requireRole(["admin"])` and rendered within `AdminLayout`.
    2. Created `/admin/roster/template/route.ts` re-exporting the CSV template download handler.
    3. Updated `RosterImporter` (`components/roster/roster-importer.tsx`) to support configurable `basePath` (default `"/coordinator/roster"`) and `templateHref` (default `"/coordinator/roster/template"`).
    4. Updated roster server actions (`app/(app)/coordinator/roster/actions.ts`) to revalidate `/admin/roster` alongside `/coordinator/roster`.
    5. Pointed "Roster import" link in `AdminSidebar` to `/admin/roster`.
    6. Reverted `CoordinatorLayout` (`app/(app)/coordinator/layout.tsx`) to unconditionally render `<AppSidebar />`.
    7. Updated sidebar test in `tests/admin/sidebar.test.ts` to assert `/admin/roster`. All 542 unit tests, linting, typechecks, and production build pass.
