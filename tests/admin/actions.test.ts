import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/roles";
import type { Session } from "@/lib/auth/session";
import { fail, ok } from "@/lib/result";

// The actions are the only door the Admin screens write through. These tests
// fake the session and the database layer, and prove two things: a caller who
// is not an active admin never reaches the database, and bad input is refused
// before any write.

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const authorize = vi.fn();
vi.mock("@/lib/auth/server", () => ({ authorize: (...args: unknown[]) => authorize(...args) }));

const rpc = {
  createDepartment: vi.fn(),
  createCourse: vi.fn(),
  createOjtBatch: vi.fn(),
  setOjtRequiredHours: vi.fn(),
  createCompany: vi.fn(),
  setCompanyStatus: vi.fn(),
  setUserActive: vi.fn(),
};
vi.mock("@/lib/db/rpc", () => rpc);

const invitations = { inviteUser: vi.fn(), revokeInvitationEverywhere: vi.fn() };
vi.mock("@/lib/auth/invitations", () => invitations);

const actions = await import("@/app/(app)/admin/actions");

const uuid = "00000000-0000-4000-8000-0000000000aa";
const userId = "00000000-0000-4000-8000-000000000001";

function session(role: Role): Session {
  return {
    userId,
    clerkId: "clerk-1",
    role,
    studentId: null,
    courseIds: [],
    companyId: null,
    isCompanyOwner: false,
    hasConsent: true,
  };
}

// One valid input per action.
const calls: { name: string; run: () => Promise<{ ok: boolean }> }[] = [
  { name: "addDepartment", run: () => actions.addDepartment({ code: "CITE", name: "IT" }) },
  {
    name: "addCourse",
    run: () => actions.addCourse({ departmentId: uuid, code: "BSIT", name: "BSIT" }),
  },
  {
    name: "addOjtBatch",
    run: () =>
      actions.addOjtBatch({
        courseId: uuid,
        schoolYear: "2026-2027",
        requiredHours: "486",
        startsOn: "",
        endsOn: "",
      }),
  },
  {
    name: "changeRequiredHours",
    run: () => actions.changeRequiredHours({ batchId: uuid, requiredHours: "500" }),
  },
  { name: "addCompany", run: () => actions.addCompany({ name: "Acme", address: "" }) },
  {
    name: "changeCompanyStatus",
    run: () => actions.changeCompanyStatus({ companyId: uuid, status: "inactive" }),
  },
  {
    name: "inviteSupervisor",
    run: () => actions.inviteSupervisor({ companyId: uuid, email: "a@example.test" }),
  },
  {
    name: "inviteCoordinator",
    run: () => actions.inviteCoordinator({ courseId: uuid, email: "a@example.test" }),
  },
  { name: "inviteAdmin", run: () => actions.inviteAdmin({ email: "a@example.test" }) },
  { name: "revokeInvitation", run: () => actions.revokeInvitation({ invitationId: uuid }) },
  { name: "toggleUserActive", run: () => actions.toggleUserActive({ userId: uuid, active: false }) },
];


function nothingWasWritten() {
  for (const fn of [...Object.values(rpc), ...Object.values(invitations)]) {
    expect(fn).not.toHaveBeenCalled();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const fn of Object.values(rpc)) fn.mockResolvedValue(ok(uuid));
  for (const fn of Object.values(invitations)) fn.mockResolvedValue(ok(uuid));
});

describe("Admin actions refuse anyone who is not an admin", () => {
  const callers: [string, () => unknown][] = [
    ["a coordinator", () => authorize.mockResolvedValue(fail("forbidden", "No access."))],
    ["a supervisor", () => authorize.mockResolvedValue(fail("forbidden", "No access."))],
    ["a student", () => authorize.mockResolvedValue(fail("forbidden", "No access."))],
    ["a signed-out visitor", () => authorize.mockResolvedValue(fail("unauthenticated", "Sign in."))],
    ["an inactive admin", () => authorize.mockResolvedValue(fail("inactive", "Deactivated."))],
  ];

  for (const call of calls) {
    for (const [label, setup] of callers) {
      it(`${call.name} refuses ${label}`, async () => {
        setup();
        const result = await call.run();
        expect(result.ok).toBe(false);
        nothingWasWritten();
      });
    }
  }

  it("asks for the admin role only", async () => {
    authorize.mockResolvedValue(ok(session("admin")));
    await actions.addCompany({ name: "Acme", address: "" });
    expect(authorize).toHaveBeenCalledWith(["admin"]);
  });
});

describe("Admin actions with an admin", () => {
  beforeEach(() => authorize.mockResolvedValue(ok(session("admin"))));

  for (const call of calls) {
    it(`${call.name} succeeds with valid input`, async () => {
      expect((await call.run()).ok).toBe(true);
    });
  }

  it("passes the signed-in admin as the actor, never an id from the form", async () => {
    await actions.addDepartment({ code: "CITE", name: "IT", actorId: "someone-else" });
    expect(rpc.createDepartment).toHaveBeenCalledWith(userId, { code: "CITE", name: "IT" });
  });

  it("turns hours into a number and blank dates into null", async () => {
    await actions.addOjtBatch({
      courseId: uuid,
      schoolYear: "2026-2027",
      requiredHours: "486.5",
      startsOn: "",
      endsOn: "2027-05-01",
    });
    expect(rpc.createOjtBatch).toHaveBeenCalledWith(userId, {
      courseId: uuid,
      schoolYear: "2026-2027",
      requiredHours: 486.5,
      startsOn: null,
      endsOn: "2027-05-01",
    });
  });

  it("sends a supervisor invitation for the chosen company", async () => {
    await actions.inviteSupervisor({ companyId: uuid, email: "a@example.test" });
    expect(invitations.inviteUser).toHaveBeenCalledWith({
      actorId: userId,
      role: "supervisor",
      email: "a@example.test",
      companyId: uuid,
    });
  });

  it("toggles a user active status", async () => {
    await actions.toggleUserActive({ userId: uuid, active: false });
    expect(rpc.setUserActive).toHaveBeenCalledWith(userId, uuid, false);
  });


  it("passes a database refusal on as a typed result", async () => {
    rpc.createDepartment.mockResolvedValue(
      fail("conflict", "A department with this code already exists."),
    );
    const result = await actions.addDepartment({ code: "CITE", name: "IT" });
    expect(result).toEqual({
      ok: false,
      error: { code: "conflict", message: "A department with this code already exists." },
    });
  });

  const bad: [string, () => Promise<{ ok: boolean }>][] = [
    ["a blank department code", () => actions.addDepartment({ code: " ", name: "IT" })],
    ["a course without a department", () => actions.addCourse({ departmentId: "x", code: "A", name: "B" })],
    [
      "a school year that does not follow",
      () =>
        actions.addOjtBatch({
          courseId: uuid,
          schoolYear: "2026-2028",
          requiredHours: "486",
          startsOn: "",
          endsOn: "",
        }),
    ],
    [
      "zero required hours",
      () => actions.changeRequiredHours({ batchId: uuid, requiredHours: "0" }),
    ],
    [
      "hours that are not a number",
      () => actions.changeRequiredHours({ batchId: uuid, requiredHours: "lots" }),
    ],
    [
      "an end date before the start date",
      () =>
        actions.addOjtBatch({
          courseId: uuid,
          schoolYear: "2026-2027",
          requiredHours: "486",
          startsOn: "2027-02-01",
          endsOn: "2027-01-01",
        }),
    ],
    ["an invalid email", () => actions.inviteAdmin({ email: "not-an-email" })],
    [
      "a status other than active or inactive",
      () => actions.changeCompanyStatus({ companyId: uuid, status: "deleted" }),
    ],
    ["an invalid user id to toggle", () => actions.toggleUserActive({ userId: "not-a-uuid", active: true })],
    ["a missing active flag", () => actions.toggleUserActive({ userId: uuid })],
    ["a missing body", () => actions.addCompany(undefined)],
  ];


  for (const [label, run] of bad) {
    it(`refuses ${label} before any write`, async () => {
      const result = await run();
      expect(result.ok).toBe(false);
      nothingWasWritten();
    });
  }
});
