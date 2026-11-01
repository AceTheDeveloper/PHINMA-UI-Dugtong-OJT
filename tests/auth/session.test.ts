import { describe, expect, it, vi } from "vitest";
import { authorizeWith, checkAccess } from "@/lib/auth/authorize";
import type { Role } from "@/lib/auth/roles";
import {
  getSession,
  type ClerkIdentity,
  type Session,
  type SessionStore,
} from "@/lib/auth/session";
import type { SessionRow } from "@/lib/auth/session-row";
import { fail, ok } from "@/lib/result";

const userId = "00000000-0000-4000-8000-000000000001";
const courseId = "00000000-0000-4000-8000-000000000002";
const companyId = "00000000-0000-4000-8000-000000000003";

function row(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    user_id: userId,
    role: "student",
    is_active: true,
    student_id: "00000000-0000-4000-8000-000000000004",
    course_ids: [courseId],
    company_id: null,
    is_company_owner: false,
    has_consent: true,
    ...overrides,
  };
}

function identity(overrides: Partial<ClerkIdentity> = {}): ClerkIdentity {
  return {
    clerkId: "clerk-1",
    email: "ana@example.test",
    emailVerified: true,
    fullName: "Ana Sample",
    invitationId: null,
    hasGoogle: false,
    ...overrides,
  };
}

function store(resolved: (SessionRow | null)[] = [row()]) {
  const resolve = vi.fn<SessionStore["resolve"]>();
  for (const next of resolved) resolve.mockResolvedValueOnce(ok(next));
  const accept = vi.fn<SessionStore["accept"]>().mockResolvedValue(ok(userId));
  return { resolve, accept } satisfies SessionStore;
}

describe("getSession", () => {
  it("refuses a visitor with no Clerk session", async () => {
    const result = await getSession(null, store());
    expect(result).toMatchObject({ ok: false, error: { code: "unauthenticated" } });
  });

  it("builds the session from our database row", async () => {
    const result = await getSession(identity(), store());
    expect(result).toEqual({
      ok: true,
      data: {
        userId,
        clerkId: "clerk-1",
        role: "student",
        studentId: "00000000-0000-4000-8000-000000000004",
        courseIds: [courseId],
        companyId: null,
        isCompanyOwner: false,
        hasConsent: true,
      },
    });
  });

  it("takes the role from the database, not from anything Clerk supplies", async () => {
    const result = await getSession(
      { ...identity(), role: "admin", publicMetadata: { role: "admin" } } as ClerkIdentity,
      store([row({ role: "student" })]),
    );
    expect(result).toMatchObject({ ok: true, data: { role: "student" } });
  });

  it("refuses a person with no account and no invitation", async () => {
    const s = store([null]);
    const result = await getSession(identity(), s);
    expect(result).toMatchObject({ ok: false, error: { code: "not_provisioned" } });
    expect(s.accept).not.toHaveBeenCalled();
  });

  it("refuses to provision from an unverified email", async () => {
    const s = store([null]);
    const result = await getSession(
      identity({ invitationId: "inv-1", emailVerified: false }),
      s,
    );
    expect(result).toMatchObject({ ok: false, error: { code: "not_provisioned" } });
    expect(s.accept).not.toHaveBeenCalled();
  });

  it("creates the account from the invitation on the first visit", async () => {
    const s = store([null, row({ role: "supervisor", company_id: companyId })]);
    const result = await getSession(identity({ invitationId: "inv-1" }), s);
    expect(s.accept).toHaveBeenCalledWith({
      clerkId: "clerk-1",
      email: "ana@example.test",
      fullName: "Ana Sample",
      invitationId: "inv-1",
    });
    expect(result).toMatchObject({ ok: true, data: { role: "supervisor", companyId } });
  });

  it("uses the email as the name when Clerk has none", async () => {
    const s = store([null, row()]);
    await getSession(identity({ invitationId: "inv-1", fullName: null }), s);
    expect(s.accept).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: "ana@example.test" }),
    );
  });

  it.each(["forbidden", "conflict", "not_found"] as const)(
    "sends someone to the no-access screen when the invitation fails with %s",
    async (code) => {
      const s = store([null]);
      s.accept.mockResolvedValue(fail(code, "Invitation was sent to a different email."));
      const result = await getSession(identity({ invitationId: "inv-1" }), s);
      expect(result).toMatchObject({
        ok: false,
        error: { code: "not_provisioned", message: "Invitation was sent to a different email." },
      });
    },
  );

  it("passes an unexpected provisioning failure through", async () => {
    const s = store([null]);
    s.accept.mockResolvedValue(fail("unexpected", "Something went wrong."));
    const result = await getSession(identity({ invitationId: "inv-1" }), s);
    expect(result).toMatchObject({ ok: false, error: { code: "unexpected" } });
  });

  it("returns a database failure instead of guessing", async () => {
    const s = store();
    s.resolve.mockReset().mockResolvedValue(fail("unexpected", "Something went wrong."));
    const result = await getSession(identity(), s);
    expect(result).toMatchObject({ ok: false, error: { code: "unexpected" } });
  });

  it("refuses a deactivated account", async () => {
    const result = await getSession(identity(), store([row({ is_active: false })]));
    expect(result).toMatchObject({ ok: false, error: { code: "inactive" } });
  });

  it("refuses an Admin who is not signed in with Google", async () => {
    const result = await getSession(identity(), store([row({ role: "admin" })]));
    expect(result).toMatchObject({ ok: false, error: { code: "google_required" } });
  });

  it("accepts an Admin signed in with Google", async () => {
    const result = await getSession(
      identity({ hasGoogle: true }),
      store([row({ role: "admin" })]),
    );
    expect(result).toMatchObject({ ok: true, data: { role: "admin" } });
  });

  it.each(["coordinator", "supervisor", "student"] as Role[])(
    "does not require Google for a %s",
    async (role) => {
      const result = await getSession(identity(), store([row({ role })]));
      expect(result.ok).toBe(true);
    },
  );
});

describe("checkAccess", () => {
  const session: Session = {
    userId,
    clerkId: "clerk-1",
    role: "coordinator",
    studentId: null,
    courseIds: [courseId],
    companyId: null,
    isCompanyOwner: false,
    hasConsent: true,
  };

  it("allows a listed role", () => {
    expect(checkAccess(session, ["coordinator", "admin"]).ok).toBe(true);
  });

  it("refuses a role that is not listed", () => {
    expect(checkAccess(session, ["student"])).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
  });

  it("requires the privacy notice unless told otherwise", () => {
    const noConsent = { ...session, hasConsent: false };
    expect(checkAccess(noConsent, ["coordinator"])).toMatchObject({
      ok: false,
      error: { code: "consent_required" },
    });
    expect(checkAccess(noConsent, ["coordinator"], { requireConsent: false }).ok).toBe(true);
  });
});

describe("authorizeWith", () => {
  it("runs the session, role, and consent checks in order", async () => {
    const allowed = await authorizeWith(identity(), store([row({ role: "coordinator" })]), [
      "coordinator",
    ]);
    expect(allowed.ok).toBe(true);

    const wrongRole = await authorizeWith(identity(), store(), ["coordinator"]);
    expect(wrongRole).toMatchObject({ ok: false, error: { code: "forbidden" } });

    const noSession = await authorizeWith(null, store(), ["student"]);
    expect(noSession).toMatchObject({ ok: false, error: { code: "unauthenticated" } });
  });
});
