import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/roles";
import type { Session } from "@/lib/auth/session";
import { fail, ok } from "@/lib/result";

// The student's daily log actions are the only door the screens write through.
// The session and the database layer are faked. These tests prove who may call
// them, that the student comes from the session, that no time is ever passed
// on, that bad input never reaches the database, and that the database's
// refusals come back as typed results.

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const authorize = vi.fn();
vi.mock("@/lib/auth/server", () => ({ authorize: (...args: unknown[]) => authorize(...args) }));

const rpc = {
  timeIn: vi.fn(),
  saveJournal: vi.fn(),
  timeOut: vi.fn(),
  resubmitLog: vi.fn(),
};
vi.mock("@/lib/db/rpc", () => rpc);

const actions = await import("@/app/(app)/student/logs/actions");

const userId = "00000000-0000-4000-8000-000000000001";
const logId = "00000000-0000-4000-8000-0000000000a1";

function allow(role: Role) {
  authorize.mockImplementation(async (allowed: readonly Role[]) =>
    allowed.includes(role)
      ? ok({
          userId,
          clerkId: "clerk-1",
          role,
          studentId: role === "student" ? "student-1" : null,
          courseIds: [],
          companyId: null,
          isCompanyOwner: false,
          hasConsent: true,
        } satisfies Session)
      : fail("forbidden", "You do not have access to this."),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  rpc.timeIn.mockResolvedValue(ok("log-1"));
  rpc.saveJournal.mockResolvedValue(ok(null));
  rpc.timeOut.mockResolvedValue(ok(null));
  rpc.resubmitLog.mockResolvedValue(ok(null));
});

const cases = [
  ["timeIn", () => actions.timeInAction(), () => rpc.timeIn],
  ["saveJournal", () => actions.saveJournalAction({ logId, journal: "hi" }), () => rpc.saveJournal],
  ["timeOut", () => actions.timeOutAction({ logId, journal: "hi" }), () => rpc.timeOut],
  ["resubmit", () => actions.resubmitLogAction({ logId, journal: "hi" }), () => rpc.resubmitLog],
] as const;

describe.each(cases)("%s", (_name, run, rpcFn) => {
  it("runs as the session student", async () => {
    allow("student");
    expect(await run()).toEqual({ ok: true, data: null });
    expect(rpcFn()).toHaveBeenCalledWith(userId, ...(_name === "timeIn" ? [] : [logId, "hi"]),
      ...(_name === "timeOut" ? [null] : []));
  });

  it.each(["admin", "supervisor", "coordinator"] as const)("refuses a %s", async (role) => {
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
    ["conflict", "This entry is not open."],
    ["validation", "Write a short journal before you time out."],
  ] as const)("passes on the database's %s refusal", async (code, message) => {
    allow("student");
    rpcFn().mockResolvedValue(fail(code, message));
    expect(await run()).toEqual({ ok: false, error: { code, message } });
  });
});

describe("time in", () => {
  it("passes on a refusal for a missing schedule", async () => {
    allow("student");
    rpc.timeIn.mockResolvedValue(
      fail("conflict", "Your supervisor has not set your work schedule yet."),
    );
    expect(await actions.timeInAction()).toMatchObject({
      ok: false,
      error: { code: "conflict" },
    });
  });
});

describe("time out", () => {
  it("passes the journal trimmed and the early reason, and no time", async () => {
    allow("student");
    await actions.timeOutAction({
      logId,
      journal: "  Fixed bugs  ",
      earlyOutReason: " Doctor ",
      timeOut: "2026-11-02T10:00:00Z",
      time_out: "2026-11-02T10:00:00Z",
    });
    expect(rpc.timeOut).toHaveBeenCalledWith(userId, logId, "Fixed bugs", "Doctor");
  });

  it("sends no reason when the reason is empty", async () => {
    allow("student");
    await actions.timeOutAction({ logId, journal: "Done", earlyOutReason: "   " });
    expect(rpc.timeOut).toHaveBeenCalledWith(userId, logId, "Done", null);
  });

  it.each([
    ["nothing", undefined],
    ["text", "text"],
    ["a bad entry id", { logId: "nope", journal: "ok" }],
    ["no journal", { logId }],
    ["an empty journal", { logId, journal: "" }],
    ["a blank journal", { logId, journal: "   " }],
    ["a journal over 4000", { logId, journal: "x".repeat(4001) }],
    ["a reason over 500", { logId, journal: "ok", earlyOutReason: "x".repeat(501) }],
    ["a journal that is not text", { logId, journal: 5 }],
  ])("never sends %s to the database", async (_name, raw) => {
    allow("student");
    expect(await actions.timeOutAction(raw)).toMatchObject({
      ok: false,
      error: { code: "validation" },
    });
    expect(rpc.timeOut).not.toHaveBeenCalled();
  });
});

describe("save journal", () => {
  it("allows an empty draft, which clears the journal", async () => {
    allow("student");
    expect(await actions.saveJournalAction({ logId, journal: "" })).toEqual({ ok: true, data: null });
    expect(rpc.saveJournal).toHaveBeenCalledWith(userId, logId, "");
  });

  it.each([
    ["a bad entry id", { logId: "nope", journal: "ok" }],
    ["no journal", { logId }],
    ["a journal over 4000", { logId, journal: "x".repeat(4001) }],
  ])("never sends %s to the database", async (_name, raw) => {
    allow("student");
    expect(await actions.saveJournalAction(raw)).toMatchObject({
      ok: false,
      error: { code: "validation" },
    });
    expect(rpc.saveJournal).not.toHaveBeenCalled();
  });
});

describe("resubmit", () => {
  it.each([
    ["a blank journal", { logId, journal: "  " }],
    ["a bad entry id", { logId: "nope", journal: "ok" }],
    ["a journal over 4000", { logId, journal: "x".repeat(4001) }],
  ])("never sends %s to the database", async (_name, raw) => {
    allow("student");
    expect(await actions.resubmitLogAction(raw)).toMatchObject({
      ok: false,
      error: { code: "validation" },
    });
    expect(rpc.resubmitLog).not.toHaveBeenCalled();
  });
});
