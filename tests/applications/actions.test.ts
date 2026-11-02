import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/roles";
import type { Session } from "@/lib/auth/session";
import { fail, ok } from "@/lib/result";

// The two application actions are the only door the student screens write
// through. The session and the database layer are faked. These tests prove who
// may call them, that the student comes from the session, that bad ids never
// reach the database, and that the database's refusals come back as typed
// results.

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const authorize = vi.fn();
vi.mock("@/lib/auth/server", () => ({ authorize: (...args: unknown[]) => authorize(...args) }));

const rpc = { applyToListing: vi.fn(), withdrawApplication: vi.fn() };
vi.mock("@/lib/db/rpc", () => rpc);

const actions = await import("@/app/(app)/student/applications/actions");

const userId = "00000000-0000-4000-8000-000000000001";
const listingId = "00000000-0000-4000-8000-0000000000c1";
const applicationId = "00000000-0000-4000-8000-0000000000d1";

function session(role: Role): Session {
  return {
    userId,
    clerkId: "clerk-1",
    role,
    studentId: role === "student" ? "student-1" : null,
    courseIds: [],
    companyId: null,
    isCompanyOwner: false,
    hasConsent: true,
  };
}

function allow(role: Role) {
  authorize.mockImplementation(async (allowed: readonly Role[]) =>
    allowed.includes(role)
      ? ok(session(role))
      : fail("forbidden", "You do not have access to this."),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  rpc.applyToListing.mockResolvedValue(ok("new-application"));
  rpc.withdrawApplication.mockResolvedValue(ok(null));
});

describe("applyToListingAction", () => {
  it("applies as the session user", async () => {
    allow("student");
    expect(await actions.applyToListingAction({ listingId })).toEqual({ ok: true, data: null });
    expect(rpc.applyToListing).toHaveBeenCalledWith(userId, listingId);
  });

  it("ignores any student or actor id sent by the browser", async () => {
    allow("student");
    await actions.applyToListingAction({ listingId, studentId: "x", actorId: "y" });
    expect(rpc.applyToListing).toHaveBeenCalledWith(userId, listingId);
  });

  it.each(["coordinator", "supervisor", "admin"] as const)("refuses a %s", async (role) => {
    allow(role);
    expect(await actions.applyToListingAction({ listingId })).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    expect(rpc.applyToListing).not.toHaveBeenCalled();
  });

  it("refuses a signed-out visitor", async () => {
    authorize.mockResolvedValue(fail("unauthenticated", "Sign in to continue."));
    expect(await actions.applyToListingAction({ listingId })).toMatchObject({
      ok: false,
      error: { code: "unauthenticated" },
    });
    expect(rpc.applyToListing).not.toHaveBeenCalled();
  });

  it.each([undefined, null, {}, { listingId: "nope" }, { listingId: 5 }, "text"])(
    "never sends %j to the database",
    async (raw) => {
      allow("student");
      expect(await actions.applyToListingAction(raw)).toMatchObject({
        ok: false,
        error: { code: "validation" },
      });
      expect(rpc.applyToListing).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["conflict", "You already applied to this listing."],
    ["not_found", "This listing is not available."],
    ["validation", "Upload your resume before applying."],
  ] as const)("passes on the database's %s refusal", async (code, message) => {
    allow("student");
    rpc.applyToListing.mockResolvedValue(fail(code, message));
    expect(await actions.applyToListingAction({ listingId })).toEqual({
      ok: false,
      error: { code, message },
    });
  });
});

describe("withdrawApplicationAction", () => {
  it("withdraws as the session user", async () => {
    allow("student");
    expect(await actions.withdrawApplicationAction({ applicationId })).toEqual({ ok: true, data: null });
    expect(rpc.withdrawApplication).toHaveBeenCalledWith(userId, applicationId);
  });

  it.each(["coordinator", "supervisor", "admin"] as const)("refuses a %s", async (role) => {
    allow(role);
    expect(await actions.withdrawApplicationAction({ applicationId })).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    expect(rpc.withdrawApplication).not.toHaveBeenCalled();
  });

  it.each([undefined, {}, { applicationId: "nope" }, { applicationId: 1 }])(
    "never sends %j to the database",
    async (raw) => {
      allow("student");
      expect(await actions.withdrawApplicationAction(raw)).toMatchObject({
        ok: false,
        error: { code: "validation" },
      });
      expect(rpc.withdrawApplication).not.toHaveBeenCalled();
    },
  );

  it("passes on the database's refusal for someone else's or a settled application", async () => {
    allow("student");
    rpc.withdrawApplication.mockResolvedValue(fail("not_found", "Application not found."));
    expect(await actions.withdrawApplicationAction({ applicationId })).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
    rpc.withdrawApplication.mockResolvedValue(fail("conflict", "Only an applied application can be withdrawn."));
    expect(await actions.withdrawApplicationAction({ applicationId })).toMatchObject({
      ok: false,
      error: { code: "conflict" },
    });
  });
});
