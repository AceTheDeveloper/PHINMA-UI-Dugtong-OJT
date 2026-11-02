import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/roles";
import type { Session } from "@/lib/auth/session";
import type { CertificateData } from "@/lib/certification/types";
import { fail, ok } from "@/lib/result";

// The download route is the only door to a certificate PDF. The session and the
// database layer are faked; the PDF is the real one. These tests prove who gets
// the file and that every refusal looks the same, so the answer does not reveal
// which certifications exist.

vi.mock("server-only", () => ({}));

const authorize = vi.fn();
vi.mock("@/lib/auth/server", () => ({ authorize: (...args: unknown[]) => authorize(...args) }));

const getCertificationForPdf = vi.fn();
vi.mock("@/lib/certification/queries", () => ({
  getCertificationForPdf: (...args: unknown[]) => getCertificationForPdf(...args),
}));

const { GET } = await import("@/app/certifications/[id]/pdf/route");

const id = "00000000-0000-4000-8000-0000000000e1";
const data: CertificateData = {
  id,
  studentName: "DELA CRUZ, JUAN",
  studentNumber: "04-2122-000001",
  courseName: "BSIT",
  companyName: "Acme",
  supervisorName: "Supervisor Reyes",
  issuerName: "Coordinator Cruz",
  approvedHours: 486,
  requiredHours: 485,
  startDate: "2026-08-18",
  endDate: "2026-10-30",
  issuedAt: "2026-11-03T02:00:00Z",
  heading: "Certificate of completion",
  body: "{student} finished {hours} hours at {company}.",
  signatories: [
    { name: "Person 1", title: "Signatory" },
    { name: "Person 2", title: "Signatory" },
  ],
};

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

function found(over: { status?: "issued" | "voided"; studentId?: string; courseId?: string } = {}) {
  getCertificationForPdf.mockResolvedValue(
    ok({
      data,
      access: {
        status: over.status ?? "issued",
        studentId: over.studentId ?? "student-1",
        courseId: over.courseId ?? "course-1",
      },
    }),
  );
}

const call = (certId = id) => GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: certId }) });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /certifications/[id]/pdf", () => {
  it("gives the student their own certification as a private PDF download", async () => {
    allow("student");
    found();
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="certification-04-2122-000001.pdf"',
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("gives a coordinator a certification of their course, and the admin any", async () => {
    allow("coordinator");
    found({ studentId: "someone-else" });
    expect((await call()).status).toBe(200);
    allow("admin");
    found({ studentId: "someone-else", courseId: "course-9" });
    expect((await call()).status).toBe(200);
  });

  it.each([
    ["another student", "student", { studentId: "student-2" }],
    ["a coordinator of another course", "coordinator", { courseId: "course-2" }],
    ["a voided one, to its own student", "student", { status: "voided" as const }],
    ["a voided one, to a coordinator", "coordinator", { status: "voided" as const }],
    ["a voided one, to the admin", "admin", { status: "voided" as const }],
  ] as const)("refuses %s with not found", async (_name, role, over) => {
    allow(role);
    found(over);
    const response = await call();
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
  });

  it("refuses a supervisor, whatever the certification", async () => {
    allow("supervisor");
    found();
    expect((await call()).status).toBe(404);
    expect(getCertificationForPdf).not.toHaveBeenCalled();
  });

  it("answers a certification that does not exist the same as one that is refused", async () => {
    allow("student");
    getCertificationForPdf.mockResolvedValue(ok(null));
    const response = await call();
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
  });

  it("tells a signed-out visitor to sign in, and asks nothing of the database", async () => {
    authorize.mockResolvedValue(fail("unauthenticated", "Sign in to continue."));
    expect((await call()).status).toBe(401);
    expect(getCertificationForPdf).not.toHaveBeenCalled();
  });

  it("refuses an inactive account like any other refusal", async () => {
    authorize.mockResolvedValue(fail("inactive", "This account is no longer active."));
    expect((await call()).status).toBe(404);
    expect(getCertificationForPdf).not.toHaveBeenCalled();
  });

  it("answers a database failure with a plain error, never the PDF and never the details", async () => {
    allow("student");
    getCertificationForPdf.mockResolvedValue(fail("unexpected", "relation \"certifications\" secret detail"));
    const response = await call();
    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Something went wrong");
  });

  it("keeps characters other than letters and digits out of the file name", async () => {
    allow("student");
    getCertificationForPdf.mockResolvedValue(
      ok({
        data: { ...data, studentNumber: '../../etc/"passwd' },
        access: { status: "issued", studentId: "student-1", courseId: "course-1" },
      }),
    );
    const response = await call();
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="certification-etcpasswd.pdf"',
    );
  });
});
