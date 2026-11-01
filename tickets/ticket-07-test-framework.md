# ticket-07: Test framework (Vitest)

- Type: chore
- Assignee: Arwin Clyde B. Simondac
- Status: in progress
- Mockup: not needed (no UI)
- AGENTS.md sections: 3 tech stack, 8 code rules, 12 open decisions, 15 local setup

## What and why

AGENTS.md section 8 requires a test for every access rule, but no test framework is installed. The developer chose Vitest (unit and access-rule tests) in ticket-06. Playwright is added later, once there are real screens to drive. This ticket adds Vitest with a working `npm run test` and one example test so later tickets can follow it.

## In scope

- Install Vitest as a dev dependency.
- `vitest.config.ts` with the `@/*` path alias from `tsconfig.json`, Node environment, and tests under `tests/`.
- `npm run test` (single run) and `npm run test:watch` scripts.
- One example test for an existing pure helper, to prove the setup works.

## Out of scope

- Playwright and browser tests.
- Component tests (needs a DOM environment; add when a ticket needs it).
- CI configuration.
- Editing AGENTS.md (see Suggested AGENTS.md changes).

## Acceptance criteria

- [x] `npm run test` runs and passes.
- [x] Typecheck and lint pass with the new files.
- [x] The example test imports through the `@/` alias.

## Test checklist

Tested by AI (tick only after actually running it, and note the command and result):

- [x] Typecheck, lint and tests pass (see commit notes: `npx tsc --noEmit`, `npm run lint`, `npm run test`)
- [x] Each acceptance criterion has a test

Tested by a human:

- [x] Ran `npm run test` locally (passes)

## Plan (AI fills in before coding)

Small change, no separate plan needed.

- [x] Plan approved by a human (framework choice approved by the developer in ticket-06)

## Open questions (AI writes here instead of guessing)

- None.

## Suggested AGENTS.md changes (a human applies these)

- Section 3: add "Tests: Vitest (unit and access-rule tests); Playwright (browser tests) once screens exist."
- Section 12: remove "Test framework" from the open decisions.
- Section 15: replace "Tests: none yet..." with "Tests: `npm run test` (watch mode: `npm run test:watch`)". Add `npm run test` to the commit-gating checks.

## Suggested new tickets (ideas found along the way, not built)

- Playwright setup, once the first real role-gated screen exists.
