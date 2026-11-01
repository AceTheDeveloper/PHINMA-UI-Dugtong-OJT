import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/roles";
import type { Session } from "@/lib/auth/session";
import { fail, ok } from "@/lib/result";

// The roster actions are the only door the roster screen writes through. The
// session, the queries, and the database layer are faked; parsing and
// validation are real. These tests prove who may call each action, that a
// coordinator stays inside their own course, that a preview never writes, and
// that a file with problems never reaches the database.

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const authorize = vi.fn();
vi.mock("@/lib/auth/server", () => ({ authorize: (...args: unknown[]) => authorize(...args) }));

const rpc = { importRoster: vi.fn() };
vi.mock("@/lib/db/rpc", () => rpc);

const invitations = { inviteUser: vi.fn(), revokeInvitationEverywhere: vi.fn() };
vi.mock("@/lib/auth/invitations", () => invitations);

const queries = {
  getBatchCourse: vi.fn(),
  getConflictContext: vi.fn(),
  getStudentForAction: vi.fn(),
  getStudentsToInvite: vi.fn(),
};
vi.mock("@/lib/roster/queries", () => queries);

const actions = await import("@/app/(app)/coordinator/roster/actions");

const batchId = "00000000-0000-4000-8000-0000000000b1";
const studentId = "00000000-0000-4000-8000-0000000000a1";
const userId = "00000000-0000-4000-8000-000000000001";
const myCourse = "course-mine";
const otherCourse = "course-other";

function session(role: Role, courseIds: string[] = [myCourse]): Session {
  return {
    userId,
    clerkId: "clerk-1",
    role,
    studentId: null,
    courseIds,
    companyId: null,
    isCompanyOwner: false,
    hasConsent: true,
  };
}

const goodCsv =
  "full_name,student_number,email\nAna Reyes,A-1,ana@example.test\nBen Santos,A-2,ben@example.test\n";

function upload(text: string, overrides: { batch?: string; name?: string } = {}) {
  const form = new FormData();
  form.set("batchId", overrides.batch ?? batchId);
  form.set("file", new File([text], overrides.name ?? "roster.csv", { type: "text/csv" }));
  return form;
}

function nothingWasWritten() {
  expect(rpc.importRoster).not.toHaveBeenCalled();
  expect(invitations.inviteUser).not.toHaveBeenCalled();
  expect(invitations.revokeInvitationEverywhere).not.toHaveBeenCalled();
}

function asCoordinator() {
  authorize.mockResolvedValue(ok(session("coordinator")));
}

beforeEach(() => {
  vi.clearAllMocks();
  queries.getBatchCourse.mockResolvedValue(ok({ courseId: myCourse, status: "active" }));
  queries.getConflictContext.mockImplementation(async (_batch: string, course: string) =>
    ok({
      courseId: course,
      numbersInBatch: new Set<string>(),
      emailCourse: new Map<string, string>(),
      accountEmails: new Set<string>(),
    }),
  );
  queries.getStudentsToInvite.mockResolvedValue(ok([]));
  queries.getStudentForAction.mockResolvedValue(
    ok({
      id: studentId,
      courseId: myCourse,
      email: "ana@example.test",
      fullName: "Ana Reyes",
      hasAccount: false,
      state: "not_invited",
      pendingInvitationId: null,
    }),
  );
  rpc.importRoster.mockResolvedValue(ok(2));
  invitations.inviteUser.mockResolvedValue(ok("invitation-1"));
  invitations.revokeInvitationEverywhere.mockResolvedValue(ok(null));
});

const calls: { name: string; run: () => Promise<{ ok: boolean }> }[] = [
  { name: "previewRoster", run: () => actions.previewRoster(upload(goodCsv)) },
  { name: "commitRoster", run: () => actions.commitRoster(upload(goodCsv)) },
  { name: "sendInvitations", run: () => actions.sendInvitations({ batchId }) },
  { name: "resendInvitation", run: () => actions.resendInvitation({ studentId }) },
];

describe("roster actions refuse anyone who is not a coordinator or admin", () => {
  const callers: [string, () => unknown][] = [
    ["a student", () => authorize.mockResolvedValue(fail("forbidden", "No access."))],
    ["a supervisor", () => authorize.mockResolvedValue(fail("forbidden", "No access."))],
    ["a signed-out visitor", () => authorize.mockResolvedValue(fail("unauthenticated", "Sign in."))],
    ["an inactive coordinator", () => authorize.mockResolvedValue(fail("inactive", "Deactivated."))],
  ];

  for (const call of calls) {
    for (const [label, setup] of callers) {
      it(`${call.name} refuses ${label}`, async () => {
        setup();
        expect((await call.run()).ok).toBe(false);
        nothingWasWritten();
        expect(queries.getBatchCourse).not.toHaveBeenCalled();
      });
    }
  }

  it("asks for the coordinator and admin roles only", async () => {
    asCoordinator();
    await actions.previewRoster(upload(goodCsv));
    expect(authorize).toHaveBeenCalledWith(["coordinator", "admin"]);
  });
});

describe("roster actions stay inside the caller's course", () => {
  beforeEach(() => {
    queries.getBatchCourse.mockResolvedValue(ok({ courseId: otherCourse, status: "active" }));
    queries.getStudentForAction.mockResolvedValue(
      ok({
        id: studentId,
        courseId: otherCourse,
        email: "x@example.test",
        fullName: "X",
        hasAccount: false,
        state: "not_invited",
        pendingInvitationId: null,
      }),
    );
  });

  for (const call of calls) {
    it(`${call.name} refuses a coordinator of another course`, async () => {
      asCoordinator();
      const result = await call.run();
      expect(result).toMatchObject({ ok: false, error: { code: "forbidden" } });
      nothingWasWritten();
    });
  }

  it("lets an admin work in any course", async () => {
    authorize.mockResolvedValue(ok(session("admin", [])));
    expect((await actions.previewRoster(upload(goodCsv))).ok).toBe(true);
  });
});

describe("previewRoster", () => {
  beforeEach(asCoordinator);

  it("returns every row with its problems and writes nothing", async () => {
    const result = await actions.previewRoster(
      upload(
        "full_name,student_number,email\nAna,A-1,ana@example.test\nBen,A-2,\nCy,A-1,cy@example.test\n",
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({ ready: 1, withProblems: 2 });
    expect(result.data.rows.map((row) => row.problems)).toEqual([
      [],
      ["Email is required."],
      ["Student number repeats row 2."],
    ]);
    nothingWasWritten();
  });

  it("refuses a closed batch", async () => {
    queries.getBatchCourse.mockResolvedValue(ok({ courseId: myCourse, status: "closed" }));
    expect(await actions.previewRoster(upload(goodCsv))).toMatchObject({
      ok: false,
      error: { code: "conflict" },
    });
  });

  it("refuses a batch that does not exist", async () => {
    queries.getBatchCourse.mockResolvedValue(ok(null));
    expect(await actions.previewRoster(upload(goodCsv))).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
  });

  const bad: [string, () => unknown][] = [
    ["no form data", () => undefined],
    ["a batch id that is not an id", () => upload(goodCsv, { batch: "not-an-id" })],
    ["a file type that is not allowed", () => upload(goodCsv, { name: "roster.txt" })],
    ["an empty file", () => upload("")],
    ["a header with missing columns", () => upload("full_name,email\nAna,a@example.test")],
  ];
  for (const [label, input] of bad) {
    it(`refuses ${label} before any lookup`, async () => {
      const result = await actions.previewRoster(input());
      expect(result.ok).toBe(false);
      nothingWasWritten();
    });
  }
});

describe("commitRoster", () => {
  beforeEach(asCoordinator);

  it("imports a clean file with the session user as the actor", async () => {
    const result = await actions.commitRoster(upload(goodCsv));
    expect(result).toEqual({ ok: true, data: { imported: 2 } });
    expect(rpc.importRoster).toHaveBeenCalledWith(userId, batchId, [
      { row: 2, fullName: "Ana Reyes", studentNumber: "A-1", email: "ana@example.test", problems: [] },
      { row: 3, fullName: "Ben Santos", studentNumber: "A-2", email: "ben@example.test", problems: [] },
    ]);
  });

  it("never sends a file with problems to the database", async () => {
    const result = await actions.commitRoster(
      upload("full_name,student_number,email\nAna,A-1,ana@example.test\nBen,A-2,not-an-email\n"),
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: "validation", message: "Fix the 1 row with problems before you commit." },
    });
    nothingWasWritten();
  });

  it("checks again on the server even if a preview looked clean", async () => {
    queries.getConflictContext.mockImplementation(async (_batch: string, course: string) =>
      ok({
        courseId: course,
        numbersInBatch: new Set(["a-1"]),
        emailCourse: new Map<string, string>(),
        accountEmails: new Set<string>(),
      }),
    );
    expect((await actions.commitRoster(upload(goodCsv))).ok).toBe(false);
    nothingWasWritten();
  });

  it("passes a database refusal on as a typed result", async () => {
    rpc.importRoster.mockResolvedValue(fail("conflict", "row 2: email is already on the roster"));
    expect(await actions.commitRoster(upload(goodCsv))).toEqual({
      ok: false,
      error: { code: "conflict", message: "row 2: email is already on the roster" },
    });
  });

  it("ignores any actor id sent in the form", async () => {
    const form = upload(goodCsv);
    form.set("actorId", "someone-else");
    await actions.commitRoster(form);
    expect(rpc.importRoster.mock.calls[0][0]).toBe(userId);
  });
});

describe("sendInvitations", () => {
  beforeEach(asCoordinator);

  const students = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `student-${i}`,
      fullName: `Student ${i}`,
      email: `s${i}@example.test`,
    }));

  it("invites each student who needs one, as the session user", async () => {
    queries.getStudentsToInvite.mockResolvedValue(ok(students(7)));
    const result = await actions.sendInvitations({ batchId });
    expect(result).toEqual({ ok: true, data: { sent: 7, failed: [] } });
    expect(invitations.inviteUser).toHaveBeenCalledTimes(7);
    expect(invitations.inviteUser).toHaveBeenCalledWith({
      actorId: userId,
      role: "student",
      email: "s0@example.test",
      studentId: "student-0",
    });
  });

  it("sends nothing when everyone is already invited", async () => {
    expect(await actions.sendInvitations({ batchId })).toEqual({
      ok: true,
      data: { sent: 0, failed: [] },
    });
    expect(invitations.inviteUser).not.toHaveBeenCalled();
  });

  it("reports each failure and still sends the rest", async () => {
    queries.getStudentsToInvite.mockResolvedValue(ok(students(3)));
    invitations.inviteUser
      .mockResolvedValueOnce(ok("a"))
      .mockResolvedValueOnce(fail("conflict", "A pending invitation already exists for this email."))
      .mockRejectedValueOnce(new Error("network"));
    const result = await actions.sendInvitations({ batchId });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sent).toBe(1);
    expect(result.data.failed).toEqual([
      { studentId: "student-1", name: "Student 1", message: "A pending invitation already exists for this email." },
      { studentId: "student-2", name: "Student 2", message: "Something went wrong. Try again in a moment." },
    ]);
  });

  it("refuses a batch id that is not an id", async () => {
    expect((await actions.sendInvitations({ batchId: "x" })).ok).toBe(false);
    nothingWasWritten();
  });
});

describe("resendInvitation", () => {
  beforeEach(asCoordinator);

  it("revokes the pending invitation, then sends a new one", async () => {
    queries.getStudentForAction.mockResolvedValue(
      ok({
        id: studentId,
        courseId: myCourse,
        email: "ana@example.test",
        fullName: "Ana Reyes",
        hasAccount: false,
        state: "pending",
        pendingInvitationId: "invitation-old",
      }),
    );
    expect((await actions.resendInvitation({ studentId })).ok).toBe(true);
    expect(invitations.revokeInvitationEverywhere).toHaveBeenCalledWith(userId, "invitation-old");
    expect(invitations.inviteUser).toHaveBeenCalledWith({
      actorId: userId,
      role: "student",
      email: "ana@example.test",
      studentId,
    });
  });

  it("only sends when there is nothing pending to revoke", async () => {
    await actions.resendInvitation({ studentId });
    expect(invitations.revokeInvitationEverywhere).not.toHaveBeenCalled();
    expect(invitations.inviteUser).toHaveBeenCalledTimes(1);
  });

  it("refuses a student who already has an account", async () => {
    queries.getStudentForAction.mockResolvedValue(
      ok({
        id: studentId,
        courseId: myCourse,
        email: "ana@example.test",
        fullName: "Ana Reyes",
        hasAccount: true,
        state: "accepted",
        pendingInvitationId: null,
      }),
    );
    expect(await actions.resendInvitation({ studentId })).toMatchObject({
      ok: false,
      error: { code: "conflict" },
    });
    nothingWasWritten();
  });

  it("does not send a new invitation if the old one could not be revoked", async () => {
    queries.getStudentForAction.mockResolvedValue(
      ok({
        id: studentId,
        courseId: myCourse,
        email: "ana@example.test",
        fullName: "Ana Reyes",
        hasAccount: false,
        state: "pending",
        pendingInvitationId: "invitation-old",
      }),
    );
    invitations.revokeInvitationEverywhere.mockResolvedValue(fail("forbidden", "Only the sender can revoke."));
    expect((await actions.resendInvitation({ studentId })).ok).toBe(false);
    expect(invitations.inviteUser).not.toHaveBeenCalled();
  });

  it("refuses a student that does not exist and a bad id", async () => {
    queries.getStudentForAction.mockResolvedValue(ok(null));
    expect(await actions.resendInvitation({ studentId })).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
    expect((await actions.resendInvitation({ studentId: "x" })).ok).toBe(false);
    nothingWasWritten();
  });
});
