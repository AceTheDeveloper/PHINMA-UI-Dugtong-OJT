import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/roles";
import type { Session } from "@/lib/auth/session";
import { fail, ok } from "@/lib/result";

// The two decision actions are the only door the applicants screen writes
// through. The session and the database layer are faked. These tests prove who
// may call them, that the supervisor comes from the session, that bad ids never
// reach the database, and that the database's refusals come back as typed
// results.

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const authorize = vi.fn();
vi.mock("@/lib/auth/server", () => ({ authorize: (...args: unknown[]) => authorize(...args) }));

const rpc = { acceptApplication: vi.fn(), rejectApplication: vi.fn() };
vi.mock("@/lib/db/rpc", () => rpc);

const actions = await import("@/app/(app)/supervisor/applicants/actions");

const userId = "00000000-0000-4000-8000-000000000001";
const applicationId = "00000000-0000-4000-8000-0000000000d1";

function allow(role: Role) {
  authorize.mockImplementation(async (allowed: readonly Role[]) =>
    allowed.includes(role)
      ? ok({
          userId,
          clerkId: "clerk-1",
          role,
          studentId: null,
          courseIds: [],
          companyId: role === "supervisor" ? "company-1" : null,
          isCompanyOwner: false,
          hasConsent: true,
        } satisfies Session)
      : fail("forbidden", "You do not have access to this."),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  rpc.acceptApplication.mockResolvedValue(ok("deployment-1"));
  rpc.rejectApplication.mockResolvedValue(ok(null));
});

const decisions = [
  ["accept", () => actions.acceptApplicationAction, () => rpc.acceptApplication],
  ["reject", () => actions.rejectApplicationAction, () => rpc.rejectApplication],
] as const;

describe.each(decisions)("%s", (_name, action, rpcFn) => {
  it("decides as the session supervisor", async () => {
    allow("supervisor");
    expect(await action()({ applicationId })).toEqual({ ok: true, data: null });
    expect(rpcFn()).toHaveBeenCalledWith(userId, applicationId);
  });

  it("ignores any actor or company sent by the browser", async () => {
    allow("supervisor");
    await action()({ applicationId, actorId: "x", companyId: "y" });
    expect(rpcFn()).toHaveBeenCalledWith(userId, applicationId);
  });

  it.each(["admin", "student", "coordinator"] as const)("refuses a %s", async (role) => {
    allow(role);
    expect(await action()({ applicationId })).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    expect(rpcFn()).not.toHaveBeenCalled();
  });

  it("refuses a signed-out visitor", async () => {
    authorize.mockResolvedValue(fail("unauthenticated", "Sign in to continue."));
    expect(await action()({ applicationId })).toMatchObject({
      ok: false,
      error: { code: "unauthenticated" },
    });
    expect(rpcFn()).not.toHaveBeenCalled();
  });

  it.each([undefined, null, {}, { applicationId: "nope" }, { applicationId: 3 }, "text"])(
    "never sends %j to the database",
    async (raw) => {
      allow("supervisor");
      expect(await action()(raw)).toMatchObject({ ok: false, error: { code: "validation" } });
      expect(rpcFn()).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["not_found", "Application not found."],
    ["conflict", "Only an application that is still waiting can be decided."],
    ["forbidden", "Only a supervisor can decide on applicants."],
  ] as const)("passes on the database's %s refusal", async (code, message) => {
    allow("supervisor");
    rpcFn().mockResolvedValue(fail(code, message));
    expect(await action()({ applicationId })).toEqual({ ok: false, error: { code, message } });
  });
});

describe("accept", () => {
  it("passes on a student who already has an active deployment", async () => {
    allow("supervisor");
    rpc.acceptApplication.mockResolvedValue(
      fail("conflict", "This student already has an active deployment."),
    );
    expect(await actions.acceptApplicationAction({ applicationId })).toEqual({
      ok: false,
      error: { code: "conflict", message: "This student already has an active deployment." },
    });
  });
});
