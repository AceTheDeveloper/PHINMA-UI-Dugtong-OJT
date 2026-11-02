import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/roles";
import type { Session } from "@/lib/auth/session";
import type { DashboardCompany, DashboardStudent } from "@/lib/coordinator/types";
import { fail, ok } from "@/lib/result";

vi.mock("server-only", () => ({}));

type Call = { table: string; filters: [string, unknown][] };
const calls: Call[] = [];
const results: Record<string, unknown> = {};
let failTable: string | null = null;

function builder(table: string) {
  const call: Call = { table, filters: [] };
  calls.push(call);
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.order = () => chain;
  chain.limit = () => chain;
  chain.eq = (column: string, value: unknown) => {
    call.filters.push([`eq:${column}`, value]);
    return chain;
  };
  chain.in = (column: string, value: unknown) => {
    call.filters.push([`in:${column}`, value]);
    return chain;
  };
  chain.then = (resolve: (value: unknown) => unknown) => {
    if (failTable === table) return resolve({ data: null, error: { message: "database error" } });
    return resolve({ data: results[table] ?? [], error: null });
  };
  return chain;
}

vi.mock("@/lib/db/admin", () => ({ adminClient: () => ({ from: builder }) }));

const mockRequireRole = vi.fn();
const mockAuthorize = vi.fn();
vi.mock("@/lib/auth/server", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
  authorize: (...args: unknown[]) => mockAuthorize(...args),
}));

const { adminStudentCsv, adminStudentCsvHead, adminStudentCsvName } = await import("@/lib/admin/export");
const { getAdminCertifications } = await import("@/lib/admin/certification-queries");
const AdminCertificationsPage = (await import("@/app/(app)/admin/certifications/page")).default;
const { GET: exportGet } = await import("@/app/(app)/admin/export/route");

function allow(role: Role, over: Partial<Session> = {}) {
  mockAuthorize.mockImplementation(async (allowed: readonly Role[]) =>
    allowed.includes(role)
      ? ok({
          userId: "user-1",
          clerkId: "clerk-1",
          role,
          studentId: null,
          courseIds: [],
          companyId: null,
          isCompanyOwner: false,
          hasConsent: true,
          ...over,
        } satisfies Session)
      : fail("forbidden", "You do not have access to this."),
  );
}

const mockCertRow = {
  id: "00000000-0000-4000-8000-0000000000c1",
  status: "issued" as const,
  student_name: "DELA CRUZ, JUAN",
  student_number: "04-2122-000001",
  course_name: "BSIT",
  company_name: "Acme Corp",
  approved_hours: 486,
  start_date: "2026-08-18",
  end_date: "2026-10-30",
  issued_at: "2026-11-03T02:00:00Z",
};

const mockVoidedCertRow = {
  id: "00000000-0000-4000-8000-0000000000c2",
  status: "voided" as const,
  student_name: "SANTOS, MARIA",
  student_number: "04-2122-000002",
  course_name: "BSIT",
  company_name: "Beta Labs",
  approved_hours: 480,
  start_date: "2026-08-18",
  end_date: "2026-10-30",
  issued_at: "2026-11-03T01:00:00Z",
};

function seed() {
  calls.length = 0;
  failTable = null;
  results.courses = [{ id: "course-1", code: "BSIT", name: "Bachelor of Science in Information Technology" }];
  results.certifications = [mockCertRow, mockVoidedCertRow];
  results.students = [
    {
      id: "student-1",
      full_name: "DELA CRUZ, JUAN",
      student_number: "04-2122-000001",
      course_id: "course-1",
      course: { code: "BSIT", name: "BS Information Technology" },
      batch: { required_hours: 486 },
    },
  ];
  results.companies = [{ id: "comp-1", name: "Acme Corp" }];
  results.supervisor_memberships = [];
  results.deployments = [
    {
      id: "dep-1",
      student_id: "student-1",
      company_id: "comp-1",
      status: "active",
      created_at: "2026-08-01T00:00:00Z",
    },
  ];
  results.deployment_hours = [{ deployment_id: "dep-1", approved_hours: 120 }];
  results.daily_logs = [{ deployment_id: "dep-1", status: "pending", log_date: "2026-11-02" }];
  results.applications = [];
}

beforeEach(() => {
  vi.resetAllMocks();
  seed();
});

describe("admin student CSV export logic", () => {
  it("includes all expected header fields and filename", () => {
    expect(adminStudentCsvHead).toEqual([
      "Course",
      "Name",
      "Student number",
      "Company",
      "Status",
      "Approved hours",
      "Pending entries",
      "Last entry date",
    ]);
    expect(adminStudentCsvName()).toBe("admin-student-progress-all-courses.csv");
  });

  it("formats student rows across companies and courses", () => {
    const students: DashboardStudent[] = [
      {
        id: "s-1",
        name: "DELA CRUZ, JUAN",
        studentNumber: "04-2122-000001",
        status: "active",
        approvedHours: 120,
        companyId: "c-1",
        deploymentId: "dep-1",
        courseCode: "BSIT",
        pendingEntries: 1,
        lastEntryDate: "2026-11-02",
      },
    ];
    const companies: DashboardCompany[] = [
      {
        id: "c-1",
        name: "Acme Corp",
        supervisors: 1,
      },
    ];

    const csv = adminStudentCsv(students, companies);
    expect(csv).toContain("Course");
    expect(csv).toContain("BSIT");
    expect(csv).toContain("DELA CRUZ, JUAN");
    expect(csv).toContain("Acme Corp");
    expect(csv).toContain("120");
    expect(csv).toContain("2026-11-02");
  });
});

describe("getAdminCertifications", () => {
  it("queries certifications across all course ids", async () => {
    const result = await getAdminCertifications();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(2);
    expect(result.data[0].studentName).toBe("DELA CRUZ, JUAN");
    expect(result.data[0].status).toBe("issued");
    expect(result.data[1].studentName).toBe("SANTOS, MARIA");
    expect(result.data[1].status).toBe("voided");

    const certCall = calls.find((c) => c.table === "certifications");
    expect(certCall).toBeDefined();
    expect(certCall?.filters).toContainEqual(["in:course_id", ["course-1"]]);
  });

  it("returns empty list if there are no courses", async () => {
    results.courses = [];
    const result = await getAdminCertifications();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });
});

describe("AdminCertificationsPage", () => {
  it("enforces admin role and renders certifications with export action", async () => {
    mockRequireRole.mockResolvedValue({
      userId: "admin-1",
      clerkId: "clerk-1",
      role: "admin",
      studentId: null,
      courseIds: [],
      companyId: null,
      isCompanyOwner: false,
      hasConsent: true,
    });

    const page = await AdminCertificationsPage();
    expect(mockRequireRole).toHaveBeenCalledWith(["admin"]);

    expect(page).toBeDefined();
    // Check that page structure is rendered (JSX tree)
    const json = JSON.stringify(page);
    expect(json).toContain("Certifications");
    expect(json).toContain("/admin/export");
    expect(json).toContain("Export student progress CSV");
    expect(json).toContain("DELA CRUZ, JUAN");
    expect(json).toContain("/certifications/00000000-0000-4000-8000-0000000000c1/pdf");
  });
});

describe("GET /admin/export", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuthorize.mockResolvedValue(fail("unauthenticated", "Please sign in to continue."));
    const res = await exportGet();
    expect(res.status).toBe(401);
  });

  it("returns 404 when role is not admin", async () => {
    allow("coordinator");
    const res = await exportGet();
    expect(res.status).toBe(404);
  });

  it("returns 200 with CSV attachment when authorized as admin", async () => {
    allow("admin");
    const res = await exportGet();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="admin-student-progress-all-courses.csv"');
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");

    const body = await res.text();
    expect(body).toContain("Course");
    expect(body).toContain("DELA CRUZ, JUAN");
  });
});
