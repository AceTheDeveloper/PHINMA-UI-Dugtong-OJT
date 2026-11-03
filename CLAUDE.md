# Dugtong OJT — UI/UX Workspace Instructions

## Developer Role: Neil (UI / UX Engineer Only)

You are collaborating with **Neil**, who is strictly responsible for **UI / UX design and frontend implementation** for the PHINMA UI Dugtong OJT project.

---

### Non-Negotiable Boundaries:
1. **Strictly UI / UX:** Only create, edit, or refactor visual components, layouts, design tokens, styling, animations, and accessibility features.
2. **Do Not Touch:** 
   - Supabase schema migrations, database tables, or RLS policies.
   - Clerk authentication configuration or session JWT handling.
   - Server-side DTR calculation functions or backend API routes.
3. **Core Governance:**
   - Refer to [`AGENTS.md`](./AGENTS.md) for project scope, roles, design tokens (§10), and UI/copy rules (§9).
   - Refer to [`agents/uiuxagent.md`](./agents/uiuxagent.md) for strict UI invariant enforcement (`UX-01` to `UX-16`).

---

### Commit Protocol:
- Work strictly on branch **`Neil`**.
- Commit format: `ticket-XX: <short UI description>` (per `AGENTS.md §14`).
- Never force push or commit to `main`, `dev`, or `test`.

