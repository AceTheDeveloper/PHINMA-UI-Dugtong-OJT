import type { Role } from "@/lib/auth/roles";
import {
  getSession,
  type ClerkIdentity,
  type Session,
  type SessionStore,
} from "@/lib/auth/session";
import { fail, ok, type Result } from "@/lib/result";

export type AuthorizeOptions = {
  // Pages and actions need the privacy notice accepted. The consent screen and
  // the post-sign-in router turn this off.
  requireConsent?: boolean;
};

// Role and consent checks on a resolved session. Scope (which course, company,
// or student) is checked next, with the helpers in lib/auth/scope.ts.
export function checkAccess(
  session: Session,
  allowed: readonly Role[],
  options: AuthorizeOptions = {},
): Result<Session> {
  if (!allowed.includes(session.role)) {
    return fail("forbidden", "You do not have access to this.");
  }
  if (options.requireConsent !== false && !session.hasConsent) {
    return fail("consent_required", "Accept the data privacy notice to continue.");
  }
  return ok(session);
}

export async function authorizeWith(
  identity: ClerkIdentity | null,
  store: SessionStore,
  allowed: readonly Role[],
  options: AuthorizeOptions = {},
): Promise<Result<Session>> {
  const session = await getSession(identity, store);
  if (!session.ok) return session;
  return checkAccess(session.data, allowed, options);
}
