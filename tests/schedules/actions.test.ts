import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/roles";
import type { Session } from "@/lib/auth/session";
import { fail, ok } from "@/lib/result";

// The set-schedule action is the only door the Students screen writes through.
// The session and the database layer are faked. These tests prove who may call
// it, that the supervisor comes from the session, that bad input never reaches
// the database, and that the database's refusals come back as typed results.

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const authorize = vi.fn();
vi.mock("@/lib/auth/server", () => ({ authorize: (...args: unknown[]) => authorize(...args) }));

const rpc = { setWorkSchedule: vi.fn() };
vi.mock("@/lib/db/rpc", () => rpc);

const { setWorkScheduleAction } = await import("@/app/(app)/supervisor/students/actions");

const userId = "00000000-0000-4000-8000-000000000001";
const deploymentId = "00000000-0000-4000-8000-0000000000d1";
const days = [
  { weekday: 1, start: "08:00", end: "17:00" },
  { weekday: 2, start: "08:00", end: "17:00" },
];
const valid = { deploymentId, effectiveFrom: "2026-11-10", days };

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
  rpc.setWorkSchedule.mockResolvedValue(ok("schedule-1"));
});

describe("setWorkScheduleAction", () => {
  it("sets the schedule as the session supervisor", async () => {
    allow("supervisor");
    expect(await setWorkScheduleAction(valid)).toEqual({ ok: true, data: null });
    expect(rpc.setWorkSchedule).toHaveBeenCalledWith(userId, valid);
  });

  it("ignores any actor or company sent by the browser", async () => {
    allow("supervisor");
    await setWorkScheduleAction({ ...valid, actorId: "x", companyId: "y" });
    expect(rpc.setWorkSchedule).toHaveBeenCalledWith(userId, valid);
  });

  it.each(["admin", "student", "coordinator"] as const)("refuses a %s", async (role) => {
    allow(role);
    expect(await setWorkScheduleAction(valid)).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    expect(rpc.setWorkSchedule).not.toHaveBeenCalled();
  });

  it("refuses a signed-out visitor", async () => {
    authorize.mockResolvedValue(fail("unauthenticated", "Sign in to continue."));
    expect(await setWorkScheduleAction(valid)).toMatchObject({
      ok: false,
      error: { code: "unauthenticated" },
    });
    expect(rpc.setWorkSchedule).not.toHaveBeenCalled();
  });

  it.each([
    ["nothing", undefined],
    ["text", "text"],
    ["a bad deployment id", { ...valid, deploymentId: "nope" }],
    ["a bad date", { ...valid, effectiveFrom: "10/11/2026" }],
    ["no days", { ...valid, days: [] }],
    ["eight days", { ...valid, days: [...days, ...days, ...days, ...days, ...days] }],
    ["a repeated weekday", { ...valid, days: [days[0], days[0]] }],
    ["a weekday of 0", { ...valid, days: [{ weekday: 0, start: "08:00", end: "17:00" }] }],
    ["a weekday of 8", { ...valid, days: [{ weekday: 8, start: "08:00", end: "17:00" }] }],
    ["a bad time", { ...valid, days: [{ weekday: 1, start: "8am", end: "17:00" }] }],
    ["an hour of 24", { ...valid, days: [{ weekday: 1, start: "24:00", end: "17:00" }] }],
    ["the same start and end", { ...valid, days: [{ weekday: 1, start: "08:00", end: "08:00" }] }],
  ])("never sends %s to the database", async (_name, raw) => {
    allow("supervisor");
    expect(await setWorkScheduleAction(raw)).toMatchObject({
      ok: false,
      error: { code: "validation" },
    });
    expect(rpc.setWorkSchedule).not.toHaveBeenCalled();
  });

  it("accepts a night shift", async () => {
    allow("supervisor");
    const night = { ...valid, days: [{ weekday: 5, start: "22:00", end: "06:00" }] };
    expect(await setWorkScheduleAction(night)).toEqual({ ok: true, data: null });
  });

  it.each([
    ["not_found", "Student not found."],
    ["conflict", "Only an active deployment has a schedule."],
    ["forbidden", "Only a supervisor can decide on applicants."],
    ["validation", "The schedule cannot start in the past."],
  ] as const)("passes on the database's %s refusal", async (code, message) => {
    allow("supervisor");
    rpc.setWorkSchedule.mockResolvedValue(fail(code, message));
    expect(await setWorkScheduleAction(valid)).toEqual({ ok: false, error: { code, message } });
  });
});
