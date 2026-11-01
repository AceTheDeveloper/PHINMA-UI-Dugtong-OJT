import type { Role } from "@/lib/auth/roles";
import type { SessionRow } from "@/lib/auth/session-row";
import { fail, ok, type Result } from "@/lib/result";

// What we know about the person from Clerk. Identity only: role, scope, and
// active state always come from our own database, never from Clerk.
export type ClerkIdentity = {
  clerkId: string;
  email: string | null;
  emailVerified: boolean;
  fullName: string | null;
  invitationId: string | null;
  // A verified Google account that matches the primary email.
  hasGoogle: boolean;
  // The account has a password, so a password sign-in is possible.
  hasPassword: boolean;
};

// The two database calls the session needs. Real implementation: lib/db/rpc.ts.
export type SessionStore = {
  resolve(clerkId: string): Promise<Result<SessionRow | null>>;
  accept(input: {
    clerkId: string;
    email: string;
    fullName: string;
    invitationId: string;
  }): Promise<Result<string>>;
};

export type Session = {
  userId: string;
  clerkId: string;
  role: Role;
  studentId: string | null;
  courseIds: string[];
  companyId: string | null;
  isCompanyOwner: boolean;
  hasConsent: boolean;
};

function toSession(clerkId: string, row: SessionRow): Session {
  return {
    userId: row.user_id,
    clerkId,
    role: row.role,
    studentId: row.student_id,
    courseIds: row.course_ids,
    companyId: row.company_id,
    isCompanyOwner: row.is_company_owner,
    hasConsent: row.has_consent,
  };
}

// Resolves who is asking. Fails closed: no identity, no account, an inactive
// account, or an Admin without Google all end in a refusal.
export async function getSession(
  identity: ClerkIdentity | null,
  store: SessionStore,
): Promise<Result<Session>> {
  if (!identity) {
    return fail("unauthenticated", "Sign in to continue.");
  }

  let resolved = await store.resolve(identity.clerkId);
  if (!resolved.ok) return resolved;

  if (!resolved.data) {
    // First visit after sign-up: create the account from the invitation.
    if (!identity.invitationId || !identity.email || !identity.emailVerified) {
      return fail(
        "not_provisioned",
        "There is no invitation for this account.",
      );
    }
    const accepted = await store.accept({
      clerkId: identity.clerkId,
      email: identity.email,
      fullName: identity.fullName ?? identity.email,
      invitationId: identity.invitationId,
    });
    if (!accepted.ok) {
      return accepted.error.code === "unexpected"
        ? accepted
        : fail("not_provisioned", accepted.error.message);
    }
    resolved = await store.resolve(identity.clerkId);
    if (!resolved.ok) return resolved;
    if (!resolved.data) {
      return fail("not_provisioned", "There is no invitation for this account.");
    }
  }

  const row = resolved.data;
  if (!row.is_active) {
    return fail("inactive", "This account is deactivated.");
  }
  // Admins must be able to sign in only through Google, which brings Google's
  // own two-step verification. A password on the account would be a way around
  // it, so an Admin with a password is refused until it is removed.
  if (row.role === "admin" && (!identity.hasGoogle || identity.hasPassword)) {
    return fail(
      "google_required",
      "Admins must sign in with Google and have no password on the account.",
    );
  }
  return ok(toSession(identity.clerkId, row));
}
