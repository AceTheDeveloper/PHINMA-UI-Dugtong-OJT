import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/roles";
import type { Session } from "@/lib/auth/session";
import { fail, ok } from "@/lib/result";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuthorize = vi.fn();
const mockRequireRole = vi.fn();

vi.mock("@/lib/auth/server", () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

// Mock rpc functions so we only test access boundaries
vi.mock("@/lib/db/rpc", () => ({
  adminReopenDailyLog: vi.fn().mockResolvedValue(ok(null)),
  adminReopenEvaluation: vi.fn().mockResolvedValue(ok(null)),
  createCompany: vi.fn().mockResolvedValue(ok(null)),
  createCourse: vi.fn().mockResolvedValue(ok(null)),
  createDepartment: vi.fn().mockResolvedValue(ok(null)),
  createListing: vi.fn().mockResolvedValue(ok(null)),
  createOjtBatch: vi.fn().mockResolvedValue(ok(null)),
  setCompanyStatus: vi.fn().mockResolvedValue(ok(null)),
  setListingStatus: vi.fn().mockResolvedValue(ok(null)),
  setOjtRequiredHours: vi.fn().mockResolvedValue(ok(null)),
  setUserActive: vi.fn().mockResolvedValue(ok(null)),
  transferCompanyOwnership: vi.fn().mockResolvedValue(ok(null)),
  updateListing: vi.fn().mockResolvedValue(ok(null)),
  updateSchoolSettings: vi.fn().mockResolvedValue(ok(null)),
}));

// Mock queries so page tests don't fail on DB calls
vi.mock("@/lib/admin/queries", () => ({
  getOverview: vi.fn().mockResolvedValue(ok({})),
  getAcademics: vi.fn().mockResolvedValue(ok([])),
  getAllCourseIds: vi.fn().mockResolvedValue(ok([])),
}));

vi.mock("@/lib/admin/student-queries", () => ({
  getAdminStudentsList: vi.fn().mockResolvedValue(ok({ students: [], companies: [], courses: [] })),
  getStudentView: vi.fn().mockResolvedValue(ok({ student: { id: "s1" } })),
}));

vi.mock("@/lib/admin/log-queries", () => ({
  getAdminLogsView: vi.fn().mockResolvedValue(ok({ rows: [], counts: {} })),
}));

vi.mock("@/lib/admin/evaluation-queries", () => ({
  getAdminEvaluations: vi.fn().mockResolvedValue(ok([])),
}));

vi.mock("@/lib/admin/certification-queries", () => ({
  getAdminCertifications: vi.fn().mockResolvedValue(ok([])),
}));

vi.mock("@/lib/admin/overview-queries", () => ({
  getAdminOverviewMetrics: vi.fn().mockResolvedValue(ok({
    departments: 0,
    courses: 0,
    batches: 0,
    coordinators: 0,
    pendingCoordinatorInvitations: 0,
    companies: 0,
    companiesWithOwner: 0,
    pendingSupervisorInvitations: 0,
    totalStudents: 0,
    activeDeployments: 0,
    completedDeployments: 0,
    applyingStudents: 0,
    noApplicationStudents: 0,
    pendingEntries: 0,
    stalePendingEntries: 0,
    openEntries: 0,
    totalApprovedHours: 0,
    activeListings: 0,
    activeCompanies: 0,
  })),
}));

vi.mock("@/components/admin/history-section", () => ({
  HistorySection: () => null,
}));

// Import actions
const {
  addDepartment,
  addCourse,
  changeRequiredHours,
  addCompany,
  transferOwnership,
  addListing,
  changeListingStatus,
  reopenDailyLog,
  reopenEvaluation,
} = await import("@/app/(app)/admin/actions");

// Import pages
const AdminOverviewPage = (await import("@/app/(app)/admin/page")).default;
const AdminStudentsPage = (await import("@/app/(app)/admin/students/page")).default;
const AdminStudentDetailPage = (await import("@/app/(app)/admin/students/[student]/page")).default;
const AdminLogsPage = (await import("@/app/(app)/admin/logs/page")).default;
const AdminEvaluationsPage = (await import("@/app/(app)/admin/evaluations/page")).default;
const AdminCertificationsPage = (await import("@/app/(app)/admin/certifications/page")).default;
const { GET: exportGet } = await import("@/app/(app)/admin/export/route");

function mockRole(role: Role | "unauthenticated") {
  if (role === "unauthenticated") {
    mockAuthorize.mockResolvedValue(fail("unauthenticated", "Please sign in to continue."));
    mockRequireRole.mockRejectedValue(new Error("REDIRECT_SIGN_IN"));
  } else {
    mockAuthorize.mockImplementation(async (allowed: readonly Role[]) =>
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
          } satisfies Session)
        : fail("forbidden", "You do not have access to this."),
    );
    mockRequireRole.mockImplementation(async (allowed: readonly Role[]) => {
      if (!allowed.includes(role)) throw new Error("REDIRECT_NO_ACCESS");
      return {
        userId: "user-1",
        clerkId: "clerk-1",
        role,
        studentId: role === "student" ? "student-1" : null,
        courseIds: role === "coordinator" ? ["course-1"] : [],
        companyId: role === "supervisor" ? "company-1" : null,
        isCompanyOwner: false,
        hasConsent: true,
      };
    });
  }
}

beforeEach(() => {
  vi.resetAllMocks();
});

const nonAdminRoles: (Role | "unauthenticated")[] = [
  "coordinator",
  "supervisor",
  "student",
  "unauthenticated",
];

describe("Admin server actions access control", () => {
  it.each(nonAdminRoles)("rejects addDepartment for %s", async (role) => {
    mockRole(role);
    const result = await addDepartment({ code: "CITE", name: "College of IT" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(["forbidden", "unauthenticated"]).toContain(result.error.code);
    }
  });

  it.each(nonAdminRoles)("rejects addCourse for %s", async (role) => {
    mockRole(role);
    const result = await addCourse({
      departmentId: "00000000-0000-4000-8000-000000000001",
      code: "BSIT",
      name: "BSIT",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(["forbidden", "unauthenticated"]).toContain(result.error.code);
    }
  });

  it.each(nonAdminRoles)("rejects changeRequiredHours for %s", async (role) => {
    mockRole(role);
    const result = await changeRequiredHours({
      batchId: "00000000-0000-4000-8000-000000000001",
      requiredHours: 486,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(["forbidden", "unauthenticated"]).toContain(result.error.code);
    }
  });

  it.each(nonAdminRoles)("rejects addCompany for %s", async (role) => {
    mockRole(role);
    const result = await addCompany({ name: "Acme Corp", address: "Iloilo City" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(["forbidden", "unauthenticated"]).toContain(result.error.code);
    }
  });

  it.each(nonAdminRoles)("rejects transferOwnership for %s", async (role) => {
    mockRole(role);
    const result = await transferOwnership({
      companyId: "00000000-0000-4000-8000-000000000001",
      newOwnerId: "00000000-0000-4000-8000-000000000002",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(["forbidden", "unauthenticated"]).toContain(result.error.code);
    }
  });

  it.each(["coordinator", "student", "unauthenticated"] as const)(
    "rejects addListing for %s",
    async (role) => {
      mockRole(role);
      const result = await addListing({
        companyId: "00000000-0000-4000-8000-000000000001",
        title: "Web Developer Intern",
        description: "Frontend development with Next.js",
        courseIds: ["00000000-0000-4000-8000-000000000002"],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(["forbidden", "unauthenticated"]).toContain(result.error.code);
      }
    },
  );

  it.each(["coordinator", "student", "unauthenticated"] as const)(
    "rejects changeListingStatus for %s",
    async (role) => {
      mockRole(role);
      const result = await changeListingStatus({
        listingId: "00000000-0000-4000-8000-000000000001",
        status: "closed",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(["forbidden", "unauthenticated"]).toContain(result.error.code);
      }
    },
  );

  it.each(nonAdminRoles)("rejects reopenDailyLog for %s", async (role) => {
    mockRole(role);
    const result = await reopenDailyLog({
      logId: "00000000-0000-4000-8000-000000000001",
      reason: "Audited support reopen",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(["forbidden", "unauthenticated"]).toContain(result.error.code);
    }
  });

  it.each(nonAdminRoles)("rejects reopenEvaluation for %s", async (role) => {
    mockRole(role);
    const result = await reopenEvaluation({
      evaluationId: "00000000-0000-4000-8000-000000000001",
      reason: "Audited support reopen",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(["forbidden", "unauthenticated"]).toContain(result.error.code);
    }
  });
});

describe("Admin pages access control", () => {
  it.each(nonAdminRoles)("rejects %s on /admin overview", async (role) => {
    mockRole(role);
    await expect(AdminOverviewPage()).rejects.toThrow();
  });

  it.each(nonAdminRoles)("rejects %s on /admin/students", async (role) => {
    mockRole(role);
    await expect(AdminStudentsPage()).rejects.toThrow();
  });

  it.each(nonAdminRoles)("rejects %s on /admin/students/[student]", async (role) => {
    mockRole(role);
    await expect(
      AdminStudentDetailPage({
        params: Promise.resolve({ student: "00000000-0000-4000-8000-000000000001" }),
      }),
    ).rejects.toThrow();
  });

  it.each(nonAdminRoles)("rejects %s on /admin/logs", async (role) => {
    mockRole(role);
    await expect(
      AdminLogsPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow();
  });

  it.each(nonAdminRoles)("rejects %s on /admin/evaluations", async (role) => {
    mockRole(role);
    await expect(AdminEvaluationsPage()).rejects.toThrow();
  });

  it.each(nonAdminRoles)("rejects %s on /admin/certifications", async (role) => {
    mockRole(role);
    await expect(AdminCertificationsPage()).rejects.toThrow();
  });
});

describe("Admin export route access control", () => {
  it.each(nonAdminRoles)("refuses %s on GET /admin/export", async (role) => {
    mockRole(role);
    const res = await exportGet();
    expect([401, 404]).toContain(res.status);
  });
});
