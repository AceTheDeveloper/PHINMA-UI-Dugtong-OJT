# Project Flags & Concerns (FLAG.md)

This file tracks open questions, architectural concerns, blockers, and items that need human review or confirmation from the Lead Dev, PM, or school coordinator.

## 📌 Status Legend
- 🔴 **[BLOCKED]** — Work cannot proceed until this is answered.
- 🟡 **[FOR REVIEW]** — Implemented or drafted, but requires review/approval.
- 🟢 **[RESOLVED]** — Addressed and resolved in code or specifications.

---

## 📝 Active Concerns

*(No active flags)*

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
