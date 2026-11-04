import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/roles";
import type { Session } from "@/lib/auth/session";
import { fail, ok } from "@/lib/result";

// The coordinator's "Edit required hours" action (ticket-32). The session, the
// batch read, and the database layer are faked. These tests prove who may call
// it, that a coordinator can only change their own course's newest batch, that
// bad input never reaches the database, and that the database's refusals come
// back as typed results.

vi.mock("server-only", () => ({}));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

const authorize = vi.fn();
vi.mock("@/lib/auth/server", () => ({ authorize: (...args: unknown[]) => authorize(...args) }));

const getBatchScope = vi.fn();
vi.mock("@/lib/coordinator/queries", () => ({
  getBatchScope: (...args: unknown[]) => getBatchScope(...args),
}));

const rpc = { setOjtRequiredHours: vi.fn() };
vi.mock("@/lib/db/rpc", () => rpc);

const { changeRequiredHoursAction } = await import("@/app/(app)/coordinator/actions");

const userId = "00000000-0000-4000-8000-000000000001";
const courseId = "00000000-0000-4000-8000-0000000000c1";
const otherCourseId = "00000000-0000-4000-8000-0000000000c2";
const batchId = "00000000-0000-4000-8000-0000000000b1";

const valid = { batchId, requiredHours: "450", confirmLarge: false };

function allow(role: Role) {
  authorize.mockImplementation(async (allowed: readonly Role[]) =>
    allowed.includes(role)
      ? ok({
          userId,
          clerkId: "clerk-1",
          role,
          studentId: null,
          courseIds: role === "coordinator" ? [courseId] : [],
          companyId: null,
          isCompanyOwner: false,
          hasConsent: true,
        } satisfies Session)
      : fail("forbidden", "You do not have access to this."),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  getBatchScope.mockResolvedValue(ok({ courseId, isNewest: true }));
  rpc.setOjtRequiredHours.mockResolvedValue(ok(null));
});

describe("changeRequiredHoursAction", () => {
  it("changes the hours as the session coordinator and refreshes the screens", async () => {
    allow("coordinator");
    expect(await changeRequiredHoursAction(valid)).toEqual({ ok: true, data: null });
    expect(authorize).toHaveBeenCalledWith(["coordinator"]);
    expect(getBatchScope).toHaveBeenCalledWith(batchId);
    expect(rpc.setOjtRequiredHours).toHaveBeenCalledWith(userId, batchId, 450);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("accepts more than 1000 hours only when confirmed", async () => {
    allow("coordinator");
    expect(
      await changeRequiredHoursAction({ ...valid, requiredHours: "1200" }),
    ).toMatchObject({ ok: false, error: { code: "validation" } });
    expect(rpc.setOjtRequiredHours).not.toHaveBeenCalled();
    expect(
      await changeRequiredHoursAction({ ...valid, requiredHours: "1200", confirmLarge: true }),
    ).toEqual({ ok: true, data: null });
    expect(rpc.setOjtRequiredHours).toHaveBeenCalledWith(userId, batchId, 1200);
  });

  it.each(["admin", "supervisor", "student"] as const)("refuses a %s", async (role) => {
    allow(role);
    expect(await changeRequiredHoursAction(valid)).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    expect(getBatchScope).not.toHaveBeenCalled();
    expect(rpc.setOjtRequiredHours).not.toHaveBeenCalled();
  });

  it("refuses a signed-out visitor", async () => {
    authorize.mockResolvedValue(fail("unauthenticated", "Sign in to continue."));
    expect(await changeRequiredHoursAction(valid)).toMatchObject({
      ok: false,
      error: { code: "unauthenticated" },
    });
    expect(rpc.setOjtRequiredHours).not.toHaveBeenCalled();
  });

  it("refuses a batch of a course the coordinator is not assigned to", async () => {
    allow("coordinator");
    getBatchScope.mockResolvedValue(ok({ courseId: otherCourseId, isNewest: true }));
    expect(await changeRequiredHoursAction(valid)).toEqual({
      ok: false,
      error: { code: "forbidden", message: "That batch is not in one of your courses." },
    });
    expect(rpc.setOjtRequiredHours).not.toHaveBeenCalled();
  });

  it("refuses a batch that does not exist, with the same answer", async () => {
    allow("coordinator");
    getBatchScope.mockResolvedValue(ok(null));
    expect(await changeRequiredHoursAction(valid)).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    expect(rpc.setOjtRequiredHours).not.toHaveBeenCalled();
  });

  it("refuses an older batch of the coordinator's course", async () => {
    allow("coordinator");
    getBatchScope.mockResolvedValue(ok({ courseId, isNewest: false }));
    expect(await changeRequiredHoursAction(valid)).toMatchObject({
      ok: false,
      error: { code: "conflict" },
    });
    expect(rpc.setOjtRequiredHours).not.toHaveBeenCalled();
  });

  it.each([
    ["nothing", undefined],
    ["text", "text"],
    ["a bad batch id", { ...valid, batchId: "nope" }],
    ["zero hours", { ...valid, requiredHours: "0" }],
    ["negative hours", { ...valid, requiredHours: "-5" }],
    ["non-numeric hours", { ...valid, requiredHours: "lots" }],
    ["more than 2000 hours", { ...valid, requiredHours: "2001", confirmLarge: true }],
    ["hours as a number, not text", { ...valid, requiredHours: 450 }],
    ["no confirmation flag", { batchId, requiredHours: "450" }],
  ])("refuses %s without touching the database", async (_label, raw) => {
    allow("coordinator");
    const result = await changeRequiredHoursAction(raw);
    expect(result).toMatchObject({ ok: false, error: { code: "validation" } });
    if (!result.ok) expect(result.error.message).toMatch(/^[A-Z][^.]*\.$/);
    expect(getBatchScope).not.toHaveBeenCalled();
    expect(rpc.setOjtRequiredHours).not.toHaveBeenCalled();
  });

  it("passes on the database's refusal and does not refresh", async () => {
    allow("coordinator");
    rpc.setOjtRequiredHours.mockResolvedValue(
      fail("forbidden", "this batch is not in one of your courses"),
    );
    expect(await changeRequiredHoursAction(valid)).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("passes on a failed batch read", async () => {
    allow("coordinator");
    getBatchScope.mockResolvedValue(fail("unexpected", "Something went wrong. Try again in a moment."));
    expect(await changeRequiredHoursAction(valid)).toMatchObject({
      ok: false,
      error: { code: "unexpected" },
    });
    expect(rpc.setOjtRequiredHours).not.toHaveBeenCalled();
  });
});
