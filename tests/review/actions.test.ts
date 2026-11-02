import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/roles";
import type { Session } from "@/lib/auth/session";
import { fail, ok } from "@/lib/result";

// The supervisor's daily approval actions are the only door the screens write
// through. The session and the database layer are faked. These tests prove who
// may call them, that the supervisor comes from the session, that bad input
// never reaches the database, and that the database's refusals come back as
// typed results.

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const authorize = vi.fn();
vi.mock("@/lib/auth/server", () => ({ authorize: (...args: unknown[]) => authorize(...args) }));

const rpc = {
  approveLog: vi.fn(),
  bulkApproveLogs: vi.fn(),
  rejectLog: vi.fn(),
  correctLog: vi.fn(),
  reopenLog: vi.fn(),
  addMissedDay: vi.fn(),
};
vi.mock("@/lib/db/rpc", () => rpc);

const actions = await import("@/app/(app)/supervisor/approvals/actions");

const userId = "00000000-0000-4000-8000-000000000001";
const logId = "00000000-0000-4000-8000-0000000000a1";
const otherLogId = "00000000-0000-4000-8000-0000000000a2";
const deploymentId = "00000000-0000-4000-8000-0000000000d1";

const correction = { logId, timeIn: "08:00", timeOut: "17:00", breakMinutes: 60, reason: "Lunch" };
const missedDay = {
  deploymentId,
  logDate: "2026-11-02",
  timeIn: "08:00",
  timeOut: "17:00",
  breakMinutes: 0,
  reason: "Phone had no signal",
};

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
  rpc.approveLog.mockResolvedValue(ok(null));
  rpc.bulkApproveLogs.mockResolvedValue(ok(2));
  rpc.rejectLog.mockResolvedValue(ok(null));
  rpc.correctLog.mockResolvedValue(ok(null));
  rpc.reopenLog.mockResolvedValue(ok(null));
  rpc.addMissedDay.mockResolvedValue(ok("log-1"));
});

const cases = [
  ["approve", () => actions.approveLogAction({ logId }), () => rpc.approveLog],
  ["bulk approve", () => actions.bulkApproveAction({ logIds: [logId, otherLogId] }), () => rpc.bulkApproveLogs],
  ["reject", () => actions.rejectLogAction({ logId, reason: "Too short" }), () => rpc.rejectLog],
  ["correct", () => actions.correctLogAction(correction), () => rpc.correctLog],
  ["reopen", () => actions.reopenLogAction({ logId, reason: "Wrong break" }), () => rpc.reopenLog],
  ["add a missed day", () => actions.addMissedDayAction(missedDay), () => rpc.addMissedDay],
] as const;

describe.each(cases)("%s", (_name, run, rpcFn) => {
  it("runs as the session supervisor", async () => {
    allow("supervisor");
    expect(await run()).toMatchObject({ ok: true });
    expect(rpcFn()).toHaveBeenCalledTimes(1);
    expect(rpcFn().mock.calls[0][0]).toBe(userId);
  });

  it.each(["admin", "student", "coordinator"] as const)("refuses a %s", async (role) => {
    allow(role);
    expect(await run()).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(rpcFn()).not.toHaveBeenCalled();
  });

  it("refuses a signed-out visitor", async () => {
    authorize.mockResolvedValue(fail("unauthenticated", "Sign in to continue."));
    expect(await run()).toMatchObject({ ok: false, error: { code: "unauthenticated" } });
    expect(rpcFn()).not.toHaveBeenCalled();
  });

  it.each([
    ["not_found", "Entry not found."],
    ["conflict", "Only a pending entry can be approved."],
    ["validation", "Give a reason."],
  ] as const)("passes on the database's %s refusal", async (code, message) => {
    allow("supervisor");
    rpcFn().mockResolvedValue(fail(code, message));
    expect(await run()).toEqual({ ok: false, error: { code, message } });
  });
});

describe("approve", () => {
  it("sends the entry id and ignores an actor sent by the browser", async () => {
    allow("supervisor");
    await actions.approveLogAction({ logId, actorId: "x", companyId: "y" });
    expect(rpc.approveLog).toHaveBeenCalledWith(userId, logId);
  });

  it.each([undefined, null, {}, { logId: "nope" }, { logId: 3 }, "text"])(
    "never sends %j to the database",
    async (raw) => {
      allow("supervisor");
      expect(await actions.approveLogAction(raw)).toMatchObject({
        ok: false,
        error: { code: "validation" },
      });
      expect(rpc.approveLog).not.toHaveBeenCalled();
    },
  );
});

describe("bulk approve", () => {
  it("returns how many were approved", async () => {
    allow("supervisor");
    expect(await actions.bulkApproveAction({ logIds: [logId, otherLogId] })).toEqual({
      ok: true,
      data: 2,
    });
    expect(rpc.bulkApproveLogs).toHaveBeenCalledWith(userId, [logId, otherLogId]);
  });

  it.each([
    ["no entries", { logIds: [] }],
    ["a bad id", { logIds: [logId, "nope"] }],
    ["more than 200", { logIds: Array.from({ length: 201 }, () => logId) }],
    ["no list", {}],
  ])("never sends %s to the database", async (_name, raw) => {
    allow("supervisor");
    expect(await actions.bulkApproveAction(raw)).toMatchObject({
      ok: false,
      error: { code: "validation" },
    });
    expect(rpc.bulkApproveLogs).not.toHaveBeenCalled();
  });
});

describe("reject and reopen", () => {
  it.each([
    ["reject", () => actions.rejectLogAction, () => rpc.rejectLog],
    ["reopen", () => actions.reopenLogAction, () => rpc.reopenLog],
  ] as const)("%s trims the reason and needs one", async (_name, action, rpcFn) => {
    allow("supervisor");
    await action()({ logId, reason: "  Because  " });
    expect(rpcFn()).toHaveBeenCalledWith(userId, logId, "Because");
    rpcFn().mockClear();
    for (const raw of [
      { logId },
      { logId, reason: "" },
      { logId, reason: "   " },
      { logId, reason: "x".repeat(501) },
      { logId: "nope", reason: "ok" },
    ]) {
      expect(await action()(raw)).toMatchObject({ ok: false, error: { code: "validation" } });
    }
    expect(rpcFn()).not.toHaveBeenCalled();
  });
});

describe("correct", () => {
  it("passes the times, break, and trimmed reason", async () => {
    allow("supervisor");
    await actions.correctLogAction({ ...correction, reason: "  Lunch  " });
    expect(rpc.correctLog).toHaveBeenCalledWith(userId, correction);
  });

  it("accepts a night shift (time out earlier than time in)", async () => {
    allow("supervisor");
    expect(
      await actions.correctLogAction({ ...correction, timeIn: "22:00", timeOut: "06:00" }),
    ).toMatchObject({ ok: true });
  });

  it.each([
    ["a bad time", { ...correction, timeIn: "8am" }],
    ["an hour of 24", { ...correction, timeOut: "24:00" }],
    ["a missing time out", { ...correction, timeOut: undefined }],
    ["a negative break", { ...correction, breakMinutes: -1 }],
    ["a break that is not whole", { ...correction, breakMinutes: 1.5 }],
    ["a break that is not a number", { ...correction, breakMinutes: Number.NaN }],
    ["a break over a day", { ...correction, breakMinutes: 1441 }],
    ["no reason", { ...correction, reason: "  " }],
    ["a bad entry id", { ...correction, logId: "nope" }],
  ])("never sends %s to the database", async (_name, raw) => {
    allow("supervisor");
    expect(await actions.correctLogAction(raw)).toMatchObject({
      ok: false,
      error: { code: "validation" },
    });
    expect(rpc.correctLog).not.toHaveBeenCalled();
  });
});

describe("add a missed day", () => {
  it("passes the day, times, break, and trimmed reason", async () => {
    allow("supervisor");
    await actions.addMissedDayAction({ ...missedDay, reason: " Phone had no signal " });
    expect(rpc.addMissedDay).toHaveBeenCalledWith(userId, missedDay);
  });

  it.each([
    ["no date", { ...missedDay, logDate: "" }],
    ["a date in the wrong format", { ...missedDay, logDate: "02/11/2026" }],
    ["a bad deployment id", { ...missedDay, deploymentId: "nope" }],
    ["a bad time", { ...missedDay, timeIn: "8am" }],
    ["no reason", { ...missedDay, reason: "" }],
    ["a reason over 500", { ...missedDay, reason: "x".repeat(501) }],
    ["a break that is not a number", { ...missedDay, breakMinutes: Number.NaN }],
  ])("never sends %s to the database", async (_name, raw) => {
    allow("supervisor");
    expect(await actions.addMissedDayAction(raw)).toMatchObject({
      ok: false,
      error: { code: "validation" },
    });
    expect(rpc.addMissedDay).not.toHaveBeenCalled();
  });
});
