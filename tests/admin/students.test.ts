import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/roles";
import type { StudentView } from "@/lib/coordinator/student-types";

vi.mock("server-only", () => ({}));

type Call = { table: string; filters: [string, unknown][] };
const calls: Call[] = [];
const results: Record<string, unknown> = {};
let failTable: string | null = null;

function builder(table: string) {
  const call: Call = { table, filters: [] };
  calls.push(call);
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = self;
  chain.order = self;
  chain.limit = self;
  const filter = (name: string) => (column: string, value: unknown) => {
    call.filters.push([`${name}:${column}`, value]);
    return chain;
  };
  chain.eq = filter("eq");
  chain.in = filter("in");
  chain.then = (resolve: (value: unknown) => unknown) =>
    failTable === table
      ? resolve({ data: null, error: { message: "database error" } })
      : resolve({ data: results[table] ?? [], error: null });
  return chain;
}

vi.mock("@/lib/db/admin", () => ({ adminClient: () => ({ from: builder }) }));

const mockRequireRole = vi.fn();
vi.mock("@/lib/auth/server", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const mockNotFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
  usePathname: () => "/admin/students",
}));

const { getAdminStudentsList } = await import("@/lib/admin/student-queries");
const { getAllCourseIds } = await import("@/lib/admin/queries");
const AdminStudentsPage = (await import("@/app/(app)/admin/students/page")).default;
const AdminStudentDetailPage = (await import("@/app/(app)/admin/students/[student]/page")).default;
const { StudentScreen } = await import("@/components/coordinator/student-screen");

const studentId = "00000000-0000-4000-8000-0000000000a1";
const courseId = "00000000-0000-4000-8000-0000000000c1";

function seed() {
  results.courses = [{ id: courseId, code: "BSIT", name: "BS Information Technology" }];
  results.students = [
    {
      id: studentId,
      full_name: "DELA CRUZ, JUAN",
      student_number: "SN-1",
      email: "juan@example.test",
      course_id: courseId,
      is_active: true,
      course: { code: "BSIT", name: "BS Information Technology" },
      batch: { school_year: "2026-2027", required_hours: "300.00" },
    },
  ];
  results.companies = [{ id: "comp-1", name: "Tech Solutions" }];
  results.supervisor_memberships = [{ company_id: "comp-1" }];
  results.deployments = [
    {
      id: "dep-1",
      student_id: studentId,
      company_id: "comp-1",
      status: "active",
      created_at: "2026-10-01T00:00:00Z",
      company: { name: "Tech Solutions" },
    },
  ];
  results.deployment_hours = [{ deployment_id: "dep-1", approved_hours: "120.50" }];
  results.daily_logs = [
    {
      id: "log-1",
      deployment_id: "dep-1",
      status: "pending",
      log_date: "2026-11-02",
      time_in: "2026-11-02T08:00:00Z",
      time_out: "2026-11-02T17:00:00Z",
      break_minutes: 60,
      journal: "Log 1",
      reject_reason: null,
      early_out_reason: null,
      correction_reason: null,
      reopen_reason: null,
      added_by: null,
    },
    {
      id: "log-2",
      deployment_id: "dep-1",
      status: "approved",
      log_date: "2026-11-01",
      time_in: "2026-11-01T08:00:00Z",
      time_out: "2026-11-01T17:00:00Z",
      break_minutes: 60,
      journal: "Log 2",
      reject_reason: null,
      early_out_reason: null,
      correction_reason: null,
      reopen_reason: null,
      added_by: null,
    },
  ];
  results.applications = [
    {
      id: "app-1",
      student_id: studentId,
      status: "accepted",
      created_at: "2026-10-01T00:00:00Z",
      listing: { title: "Intern", company: { name: "Tech Solutions" } },
    },
  ];
}

describe("getAdminStudentsList", () => {
  beforeEach(() => {
    calls.length = 0;
    failTable = null;
    seed();
  });

  it("returns all students mapped with course code and stats across all courses", async () => {
    const result = await getAdminStudentsList();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.students).toHaveLength(1);
    const student = result.data.students[0];
    expect(student.name).toBe("DELA CRUZ, JUAN");
    expect(student.studentNumber).toBe("SN-1");
    expect(student.courseId).toBe(courseId);
    expect(student.courseCode).toBe("BSIT");
    expect(student.companyId).toBe("comp-1");
    expect(student.approvedHours).toBe(120.5);
    expect(student.pendingEntries).toBe(1);
    expect(student.lastEntryDate).toBe("2026-11-02");
    expect(student.status).toBe("active");

    expect(result.data.companies).toHaveLength(1);
    expect(result.data.companies[0].name).toBe("Tech Solutions");
    expect(result.data.companies[0].supervisors).toBe(1);
  });

  it("returns database error when query fails", async () => {
    failTable = "students";
    const result = await getAdminStudentsList();
    expect(result.ok).toBe(false);
  });
});

describe("getAllCourseIds", () => {
  beforeEach(() => {
    calls.length = 0;
    failTable = null;
    seed();
  });

  it("queries courses table and returns all ids", async () => {
    const result = await getAllCourseIds();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([courseId]);
  });
});

describe("admin students access control", () => {
  beforeEach(() => {
    calls.length = 0;
    failTable = null;
    seed();
    mockRequireRole.mockReset();
    mockNotFound.mockClear();
  });

  it("allows admin access to /admin/students list", async () => {
    mockRequireRole.mockResolvedValueOnce({
      userId: "u1",
      role: "admin" as Role,
      courseIds: [],
    });
    const page = await AdminStudentsPage();
    expect(page).toBeDefined();
    expect(mockRequireRole).toHaveBeenCalledWith(["admin"]);
  });

  it("refuses non-admin roles for /admin/students", async () => {
    mockRequireRole.mockRejectedValueOnce(new Error("REDIRECT_NO_ACCESS"));
    await expect(AdminStudentsPage()).rejects.toThrow("REDIRECT_NO_ACCESS");
    expect(mockRequireRole).toHaveBeenCalledWith(["admin"]);
  });

  it("allows admin access to /admin/students/[student] and passes showResume=false", async () => {
    mockRequireRole.mockResolvedValueOnce({
      userId: "u1",
      role: "admin" as Role,
      courseIds: [],
    });
    // Populate single student query response
    results.resumes = [{ student_id: studentId }];
    results.ojt_batches = [{ school_year: "2026-2027", required_hours: "300.00" }];
    results.work_schedules = [];
    results.evaluations = [];
    results.certifications = [];

    const page = await AdminStudentDetailPage({
      params: Promise.resolve({ student: studentId }),
    });
    expect(page).toBeDefined();
    expect(mockRequireRole).toHaveBeenCalledWith(["admin"]);
    // Check that StudentScreen was created with showResume=false
    expect(page.props.showResume).toBe(false);
    expect(page.props.backHref).toBe("/admin/students");
  });

  it("triggers notFound() when student does not exist", async () => {
    mockRequireRole.mockResolvedValueOnce({
      userId: "u1",
      role: "admin" as Role,
      courseIds: [],
    });
    results.students = [];

    await expect(
      AdminStudentDetailPage({
        params: Promise.resolve({ student: "00000000-0000-4000-8000-000000000099" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
  });
});

describe("StudentScreen resume visibility rule", () => {
  const dummyView: StudentView = {
    profile: {
      id: studentId,
      name: "Juan Dela Cruz",
      studentNumber: "SN-1",
      email: "juan@example.test",
      isActive: true,
      courseLabel: "BSIT",
      batchLabel: "2026-2027",
      requiredHours: 300,
    },
    stage: "active",
    hasResume: true,
    applications: [],
    deployments: [],
  };

  it("omits resume button when showResume is false (Admin view)", () => {
    const screen = StudentScreen({ view: dummyView, showResume: false });
    // In React element tree, check children of the profile section for ResumeButton
    const section = screen.props.children[1];
    const resumeElement = section.props.children[2];
    expect(resumeElement).toBeNull();
  });

  it("renders resume button when showResume is true (Coordinator view)", () => {
    const screen = StudentScreen({ view: dummyView, showResume: true });
    const section = screen.props.children[1];
    const resumeElement = section.props.children[2];
    expect(resumeElement).not.toBeNull();
  });
});
