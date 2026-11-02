import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/roles";
import type { Session } from "@/lib/auth/session";
import { fail, ok } from "@/lib/result";
import { pdfText } from "../helpers/pdf-text";

// The DTR route and the CSV route are the only doors to those files. The session
// and the database layer are faked; the PDF and the CSV are the real ones. These
// tests prove who gets each file and that every refusal looks the same, so the
// answer does not reveal which exist.

vi.mock("server-only", () => ({}));

const authorize = vi.fn();
vi.mock("@/lib/auth/server", () => ({ authorize: (...args: unknown[]) => authorize(...args) }));

const getDtr = vi.fn();
vi.mock("@/lib/dtr/queries", () => ({ getDtr: (...args: unknown[]) => getDtr(...args) }));

const getDashboard = vi.fn();
vi.mock("@/lib/coordinator/queries", () => ({ getDashboard: (...args: unknown[]) => getDashboard(...args) }));

const dtrRoute = await import("@/app/dtr/[deployment]/pdf/route");
const csvRoute = await import("@/app/(app)/coordinator/export/route");

const deployment = "00000000-0000-4000-8000-0000000000d1";

function allow(role: Role, over: Partial<Session> = {}) {
  authorize.mockImplementation(async (allowed: readonly Role[]) =>
    allowed.includes(role)
      ? ok({
          userId: "user-1",
          clerkId: "clerk-1",
          role,
          studentId: role === "student" ? "student-1" : null,
          courseIds: role === "coordinator" ? ["course-1"] : [],
          companyId: role === "supervisor" ? "company-1" : null,
          isCompanyOwner: false,
          hasConsent: true,
          ...over,
        } satisfies Session)
      : fail("forbidden", "You do not have access to this."),
  );
}

function found(over: { studentId?: string; companyId?: string; courseId?: string; studentNumber?: string } = {}) {
  getDtr.mockResolvedValue(
    ok({
      access: {
        studentId: over.studentId ?? "student-1",
        companyId: over.companyId ?? "company-1",
        courseId: over.courseId ?? "course-1",
      },
      data: {
        studentName: "DELA CRUZ, JUAN",
        studentNumber: over.studentNumber ?? "04-2122-000001",
        supervisorName: "Supervisor Reyes",
        entries: [
          {
            date: "2026-11-02",
            timeIn: "2026-11-02T00:00:00Z",
            timeOut: "2026-11-02T09:00:00Z",
            minutes: 540,
          },
        ],
      },
    }),
  );
}

const callDtr = (id = deployment) =>
  dtrRoute.GET(new Request("http://localhost/x"), { params: Promise.resolve({ deployment: id }) });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /dtr/[deployment]/pdf", () => {
  it("gives the student their own DTR as a private PDF download", async () => {
    allow("student");
    found();
    const response = await callDtr();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="dtr-04-2122-000001.pdf"');
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Buffer.from(bytes).subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdfText(bytes)).toContain("DELA CRUZ, JUAN (04-2122-000001)");
  });

  it.each([
    ["a supervisor of that company", "supervisor"],
    ["a coordinator of that course", "coordinator"],
    ["the admin", "admin"],
  ] as const)("gives it to %s", async (_name, role) => {
    allow(role);
    found({ studentId: "someone-else" });
    expect((await callDtr()).status).toBe(200);
  });

  it.each([
    ["another student", "student", { studentId: "student-2" }],
    ["a supervisor of another company", "supervisor", { companyId: "company-2" }],
    ["a coordinator of another course", "coordinator", { courseId: "course-2" }],
  ] as const)("refuses %s with not found", async (_name, role, over) => {
    allow(role);
    found(over);
    const response = await callDtr();
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
  });

  it("answers a deployment that does not exist the same as one that is refused", async () => {
    allow("student");
    getDtr.mockResolvedValue(ok(null));
    const response = await callDtr();
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
  });

  it("tells a signed-out visitor to sign in, and asks nothing of the database", async () => {
    authorize.mockResolvedValue(fail("unauthenticated", "Sign in to continue."));
    expect((await callDtr()).status).toBe(401);
    expect(getDtr).not.toHaveBeenCalled();
  });

  it("refuses an inactive account like any other refusal", async () => {
    authorize.mockResolvedValue(fail("inactive", "This account is no longer active."));
    expect((await callDtr()).status).toBe(404);
    expect(getDtr).not.toHaveBeenCalled();
  });

  it("answers a database failure with a plain error and never the details", async () => {
    allow("student");
    getDtr.mockResolvedValue(fail("unexpected", 'relation "daily_logs" secret detail'));
    const response = await callDtr();
    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Something went wrong");
  });

  it("keeps characters other than letters, digits, and dashes out of the file name", async () => {
    allow("student");
    found({ studentNumber: '../../etc/"passwd' });
    expect((await callDtr()).headers.get("Content-Disposition")).toBe('attachment; filename="dtr-etcpasswd.pdf"');
  });
});

const dashboard = {
  course: { courseShort: "BSIT", batchLabel: "2026-2027", requiredHours: 486 },
  students: [
    {
      id: "s1",
      name: "=EVIL()",
      studentNumber: "SN-1",
      companyId: null,
      deploymentId: null,
      status: "active",
      approvedHours: 10,
      pendingEntries: 0,
      lastEntryDate: null,
    },
  ],
  companies: [],
};

describe("GET /coordinator/export", () => {
  it("gives a coordinator the CSV of their course, built from their own course ids", async () => {
    allow("coordinator");
    getDashboard.mockResolvedValue(ok(dashboard));
    const response = await csvRoute.GET();
    expect(getDashboard).toHaveBeenCalledWith(["course-1"]);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="student-progress-BSIT-2026-2027.csv"',
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    // text() would strip the byte-order mark, so look at the raw bytes: EF BB BF.
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes)).toContain(`"'=EVIL()"`);
  });

  it.each(["admin", "supervisor", "student"] as const)("refuses a %s with not found", async (role) => {
    allow(role);
    const response = await csvRoute.GET();
    expect(response.status).toBe(404);
    expect(getDashboard).not.toHaveBeenCalled();
  });

  it("tells a signed-out visitor to sign in", async () => {
    authorize.mockResolvedValue(fail("unauthenticated", "Sign in to continue."));
    expect((await csvRoute.GET()).status).toBe(401);
    expect(getDashboard).not.toHaveBeenCalled();
  });

  it("is not found when the coordinator has no course or batch yet", async () => {
    allow("coordinator");
    getDashboard.mockResolvedValue(ok(null));
    expect((await csvRoute.GET()).status).toBe(404);
  });

  it("answers a database failure with a plain error", async () => {
    allow("coordinator");
    getDashboard.mockResolvedValue(fail("unexpected", "secret detail"));
    const response = await csvRoute.GET();
    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Something went wrong");
  });
});
