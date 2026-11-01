# ticket-09: Authentication and authorization

- Type: feature
- Assignee: Arwin Clyde B. Simondac
- Status: todo
- Mockup: design canvas https://claude.ai/artifact/APqaZ2x74WjcWfxQHugUmz (screens built in ticket-10)
- AGENTS.md sections: 3 stack, 4 roles, 7 security and audit, 8 code rules, 14 tickets
- Plan: `plan.md`, "Plan: authentication and authorization (ticket-09)" (approved)

## What and why

Sign-in, invitation-only sign-up, and the server checks every later feature relies on. Clerk answers who the person is; our database answers what they may do. After this ticket, any page or action calls one helper and gets a role and scope, or a typed refusal. It wires the screens built in ticket-10 to Clerk.

## In scope

1. **Migration 4:** on `invitations` drop `token_hash`, add `clerk_invitation_id` (unique) and `course_id`, and update the target check (student needs a student, supervisor a company, coordinator a course, admin none). Add `consent_notice_version` to `school_settings`.
2. **Write functions** (called through `rpc` with the actor id, executable only by the service role): `create_invitation`, `accept_invitation` (atomic and idempotent), `record_consent`, `set_user_active`. Each sets the audit actor inside its transaction.
3. **Dependencies:** `@clerk/nextjs`, `@supabase/supabase-js`, `zod`, `server-only`, `react-hook-form` and its Zod resolver for the sign-in and accept-invitation forms.
4. **Code** (paths in the plan): `proxy.ts`, `lib/result.ts`, `lib/auth/session.ts`, `authorize.ts`, `scope.ts`, `provision.ts`, `lib/db/admin.ts`, `lib/db/user.ts`, `lib/db/rpc.ts`, `scripts/bootstrap-admin.ts` (`npm run bootstrap:admin -- <email>`), and `.env.example`.
5. **Wire the ticket-10 screens:** real sign-in (email and password, and Google), accept invitation, consent recording, and the no-access and deactivated screens driven by the session. Role home routes `/student`, `/supervisor`, `/coordinator`, `/admin`.
6. **Route protection:** the proxy keeps `/`, `/sign-in`, `/accept-invitation`, and branding assets public; everything else needs a session. Real authorization stays in layouts, actions, and route handlers.
7. **Tests** listed in the plan.
8. Add the environment variable names to AGENTS.md section 15 (proposed under "Suggested AGENTS.md changes").

## Out of scope

- Admin and coordinator invitation screens, roster import, company management (later tickets call `create_invitation`).
- The Clerk webhook for changed or deleted emails (REMEMBER in `plan.md`).
- Switching invitation emails to Resend (REMEMBER in `plan.md`).
- RLS select policies (the RLS ticket); `lib/db/user.ts` is added but unused until then.
- Forgot-password flow beyond Clerk's default.

## Acceptance criteria

- [ ] A person with no invitation cannot create an account or reach any page except the public ones.
- [ ] Accepting a valid invitation creates exactly one `users` row with the invited role and links the roster record, membership, or course assignment; the first supervisor of a company becomes its owner.
- [ ] An expired, used, revoked, or wrongly addressed invitation is refused, and a failed acceptance changes nothing.
- [ ] A second call for the same Clerk user returns the existing user.
- [ ] `create_invitation` allows and refuses each role pairing as in the plan.
- [ ] A deactivated user is refused on the next request, and sees the deactivated screen.
- [ ] An Admin who did not sign in with Google is refused; the other roles are unaffected.
- [ ] The role, scope, and active state are read from our database, never from Clerk token claims or metadata.
- [ ] The service-role key appears only in server-only modules.
- [ ] Public routes are exactly `/`, `/sign-in`, `/accept-invitation`, and branding assets, and a test fails if that list changes.
- [ ] Consent is required before any role home, and recorded per notice version.
- [ ] Lint, typecheck, tests, and build pass.

## Test checklist

Tested by AI (tick only after actually running it, and note the command and result):

- [ ] Lint, typecheck, tests, and build pass
- [ ] Each acceptance criterion has a test

Tested by a human:

- [ ] Signed in as each role in the browser, including Google, invitation acceptance, consent, and the deactivated screen
- [ ] Clerk dashboard steps done (below)

## Plan (link to the plan in plan.md; plan first for any new feature)

See `plan.md`, "Plan: authentication and authorization (ticket-09)".

Human steps in the dashboards (before the browser checks):

1. Clerk: set the access mode to Invite-only; turn on email and password with email verification, and Google as a social connection; activate the Supabase integration and copy the Clerk domain.
2. Supabase: Authentication, Sign In / Providers, add Clerk and paste the domain.
3. Apply migration 4 with `npx supabase db push`.

- [x] Plan approved by a human (approved by the developer in session)

## Open questions (AI writes here instead of guessing)

- Two-step verification is off: Clerk's authenticator app is Pro only and we stay on the free plan (see `plan.md`, REMEMBER).
- Revoking a Clerk invitation is not confirmed in the docs; checked during the build.

## Suggested AGENTS.md changes (a human applies these)

- Section 15: add the environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only), `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (server-only). Remove the TODO line once added.

## Suggested new tickets (ideas found along the way, not built)

- Clerk webhook for `user.updated` and `user.deleted` (before the pilot goes live).
- Resend for invitation emails.
- Production Clerk instance with its own keys and Google credentials (before real users).
