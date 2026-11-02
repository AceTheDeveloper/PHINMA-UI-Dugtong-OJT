# Project Flags & Concerns (FLAG.md)

This file tracks open questions, architectural concerns, blockers, and items that need human review or confirmation from the Lead Dev, PM, or school coordinator.

## 📌 Status Legend
- 🔴 **[BLOCKED]** — Work cannot proceed until this is answered.
- 🟡 **[FOR REVIEW]** — Implemented or drafted, but requires review/approval.
- 🟢 **[RESOLVED]** — Addressed and resolved in code or specifications.

---

## 📝 Active Concerns

### [FLAG-01] Dedicated Roster Import for Platform Admin
- **Date Added:** 2026-11-02
- **Branch / Ticket:** `josiah` / `ticket-05`
- **Status:** 🟡 [FOR REVIEW]
- **Concern / Question:**
  - Lead Dev (Arwin) noted that Platform Admin should eventually have its own dedicated roster import screen/endpoint instead of reusing the `/coordinator/roster` endpoint (*"dapat may kaugalingon sya nga import"*, *"Huo, pro karon lng"*).
  - The current implementation shares `/coordinator/roster` and dynamically swaps `<AdminSidebar />` for admins inside `CoordinatorLayout` so work can proceed without blocking ticket progress.
- **Impact / Context:**
  - The feature is fully functional and tested, but couples Platform Admin navigation to the `/coordinator/*` route tree.
  - Arwin instructed to keep it as-is for now (*"Subong okay lng na, focus anay sa tickets, karon i flags ta na sya"*), but it should be refactored into a standalone `/admin/roster` endpoint before final merge or during clean-up.
- **Possible Options:**
  - Option A: Keep using `/coordinator/roster` with dynamic layout switching based on role (current temporary implementation).
  - Option B: Create a dedicated `/admin/roster` page that imports the roster components directly under `app/(app)/admin/roster/page.tsx`, decoupling Admin from `/coordinator/*`.
- **Owner to Consult:**
  - Arwin Clyde (Lead Dev)
- **Resolution / Decision:** *(Leave blank until resolved)*

---

## ✅ Resolved Flags

*(Move resolved concerns here with their final decisions and commit references)*
