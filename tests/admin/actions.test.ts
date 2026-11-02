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
  transferCompanyOwnership: vi.fn(),
  createListing: vi.fn(),
  updateListing: vi.fn(),
  setListingStatus: vi.fn(),
  updateSchoolSettings: vi.fn(),
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
  {
    name: "transferOwnership",
    run: () => actions.transferOwnership({ companyId: uuid, newOwnerId: uuid }),
  },
  {
    name: "addListing",
    run: () => actions.addListing({ companyId: uuid, title: "Intern", courseIds: [uuid] }),
  },
  {
    name: "editListing",
    run: () => actions.editListing({ listingId: uuid, title: "Intern", courseIds: [uuid] }),
  },
  {
    name: "changeListingStatus",
    run: () => actions.changeListingStatus({ listingId: uuid, status: "closed" }),
  },
  {
    name: "saveSchoolSettings",
    run: () =>
      actions.saveSchoolSettings({
        name: "PHINMA UI",
        timezone: "Asia/Manila",
        consentNoticeVersion: "v1",
      }),
  },
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

  it("transfers company ownership", async () => {
    const newOwnerId = "00000000-0000-4000-8000-000000000002";
    await actions.transferOwnership({ companyId: uuid, newOwnerId });
    expect(rpc.transferCompanyOwnership).toHaveBeenCalledWith(userId, uuid, newOwnerId);
  });

  it("creates a listing", async () => {
    await actions.addListing({
      companyId: uuid,
      title: "Backend Intern",
      description: "Node.js",
      courseIds: [uuid],
    });
    expect(rpc.createListing).toHaveBeenCalledWith(userId, {
      companyId: uuid,
      title: "Backend Intern",
      description: "Node.js",
      courseIds: [uuid],
    });
  });

  it("edits a listing", async () => {
    await actions.editListing({
      listingId: uuid,
      title: "Backend Intern Updated",
      description: "Node.js & Postgres",
      courseIds: [uuid],
    });
    expect(rpc.updateListing).toHaveBeenCalledWith(userId, {
      listingId: uuid,
      title: "Backend Intern Updated",
      description: "Node.js & Postgres",
      courseIds: [uuid],
    });
  });

  it("changes listing status", async () => {
    await actions.changeListingStatus({ listingId: uuid, status: "closed" });
    expect(rpc.setListingStatus).toHaveBeenCalledWith(userId, uuid, "closed");
  });

  it("saves school settings", async () => {
    await actions.saveSchoolSettings({
      name: "PHINMA UI",
      timezone: "Asia/Manila",
      consentNoticeVersion: "v2",
    });
    expect(rpc.updateSchoolSettings).toHaveBeenCalledWith(userId, {
      name: "PHINMA UI",
      timezone: "Asia/Manila",
      consentNoticeVersion: "v2",
    });
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
    ["an invalid company id for transfer", () => actions.transferOwnership({ companyId: "not-a-uuid", newOwnerId: uuid })],
    ["an invalid new owner id for transfer", () => actions.transferOwnership({ companyId: uuid, newOwnerId: "not-a-uuid" })],
    ["a listing with no courses", () => actions.addListing({ companyId: uuid, title: "Intern", courseIds: [] })],
    ["a listing with blank title", () => actions.addListing({ companyId: uuid, title: "   ", courseIds: [uuid] })],
    ["an invalid listing status", () => actions.changeListingStatus({ listingId: uuid, status: "archived" })],
    ["blank school name", () => actions.saveSchoolSettings({ name: " ", timezone: "Asia/Manila", consentNoticeVersion: "v1" })],
    ["blank timezone", () => actions.saveSchoolSettings({ name: "School", timezone: " ", consentNoticeVersion: "v1" })],
    ["blank consent version", () => actions.saveSchoolSettings({ name: "School", timezone: "Asia/Manila", consentNoticeVersion: " " })],
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
