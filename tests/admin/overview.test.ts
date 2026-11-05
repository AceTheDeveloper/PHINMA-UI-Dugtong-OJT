import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
vi.mock("@/lib/auth/server", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

// Mock HistorySection to keep overview unit test isolated
vi.mock("@/components/admin/history-section", () => ({
  HistorySection: () => null,
}));

const { getAdminOverviewMetrics } = await import("@/lib/admin/overview-queries");
const AdminOverviewPage = (await import("@/app/(app)/admin/page")).default;

function seed() {
  calls.length = 0;
  failTable = null;
  results.departments = [{ id: "dept-1", is_active: true }];
  results.courses = [{ id: "course-1", is_active: true }];
  results.ojt_batches = [{ id: "batch-1" }];
  results.coordinator_assignments = [{ user_id: "coord-1" }];
  results.invitations = [
    { role: "coordinator", status: "pending" },
    { role: "supervisor", status: "pending" },
  ];
  results.companies = [
    { id: "comp-1", status: "active" },
    { id: "comp-2", status: "inactive" },
  ];
  results.supervisor_memberships = [{ company_id: "comp-1", is_owner: true }];
  results.listings = [
    { id: "list-1", status: "open" },
    { id: "list-2", status: "closed" },
  ];
  results.students = [
    { id: "student-1", is_active: true },
    { id: "student-2", is_active: true },
    { id: "student-3", is_active: true },
    { id: "student-4", is_active: true },
  ];
  results.deployments = [
    { id: "dep-1", student_id: "student-1", status: "active" },
    { id: "dep-2", student_id: "student-2", status: "completed" },
  ];
  results.applications = [
    { id: "app-1", student_id: "student-3", status: "applied" },
  ];
  results.deployment_hours = [
    { approved_hours: 120.5 },
    { approved_hours: 486.0 },
  ];
  results.daily_logs = [
    { id: "log-1", status: "open", log_date: "2026-11-03" },
    { id: "log-2", status: "pending", log_date: "2026-11-02" },
    { id: "log-3", status: "pending", log_date: "2026-10-25" }, // stale (> 3 days)
  ];
}

// The log dates above are written for this day (Asia/Manila). The stale count is
// "pending for more than 3 days", so it moves with the real date unless the clock
// is pinned; the test failed from 2026-11-06 for that reason alone.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-03T04:00:00Z"));
  vi.resetAllMocks();
  seed();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getAdminOverviewMetrics", () => {
  it("calculates student stages, log statuses, hours, and ecosystem counts", async () => {
    const res = await getAdminOverviewMetrics();
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const data = res.data;
    expect(data.departments).toBe(1);
    expect(data.courses).toBe(1);
    expect(data.batches).toBe(1);
    expect(data.coordinators).toBe(1);
    expect(data.pendingCoordinatorInvitations).toBe(1);
    expect(data.companies).toBe(2);
    expect(data.companiesWithOwner).toBe(1);
    expect(data.pendingSupervisorInvitations).toBe(1);

    expect(data.totalStudents).toBe(4);
    expect(data.activeDeployments).toBe(1); // student-1
    expect(data.completedDeployments).toBe(1); // student-2
    expect(data.applyingStudents).toBe(1); // student-3
    expect(data.noApplicationStudents).toBe(1); // student-4

    expect(data.openEntries).toBe(1);
    expect(data.pendingEntries).toBe(2);
    expect(data.stalePendingEntries).toBe(1);
    expect(data.totalApprovedHours).toBe(606.5);

    expect(data.activeCompanies).toBe(1);
    expect(data.activeListings).toBe(1);
  });

  it("handles empty database gracefully", async () => {
    results.departments = [];
    results.courses = [];
    results.ojt_batches = [];
    results.coordinator_assignments = [];
    results.invitations = [];
    results.companies = [];
    results.supervisor_memberships = [];
    results.listings = [];
    results.students = [];
    results.deployments = [];
    results.applications = [];
    results.deployment_hours = [];
    results.daily_logs = [];

    const res = await getAdminOverviewMetrics();
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.data.totalStudents).toBe(0);
    expect(res.data.activeDeployments).toBe(0);
    expect(res.data.totalApprovedHours).toBe(0);
    expect(res.data.pendingEntries).toBe(0);
  });

  it("returns error result on database failure", async () => {
    failTable = "students";
    const res = await getAdminOverviewMetrics();
    expect(res.ok).toBe(false);
  });
});

describe("AdminOverviewPage", () => {
  it("enforces admin role and renders focal panel, metrics rows, and export button", async () => {
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

    const page = await AdminOverviewPage();
    expect(mockRequireRole).toHaveBeenCalledWith(["admin"]);

    const seen = new WeakSet();
    const json = JSON.stringify(page, (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) return undefined;
        seen.add(value);
      }
      return value;
    });
    // Header & export
    expect(json).toContain("Overview");
    expect(json).toContain("/admin/export");
    expect(json).toContain("Export progress CSV");

    // Focal point
    expect(json).toContain("STUDENTS ON OJT");
    expect(json).toContain("active deployments out of");

    // Operations rows
    expect(json).toContain("Daily operations & approvals");
    expect(json).toContain("/admin/logs?status=pending");
    expect(json).toContain("/admin/logs?status=stale");
    expect(json).toContain("/admin/logs?status=no-time-out");
    expect(json).toContain("/admin/companies");
    expect(json).toContain("/admin/listings");

    // Setup steps
    expect(json).toContain("Setup steps");
  });

  it("renders load error if query fails", async () => {
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
    failTable = "students";

    const page = await AdminOverviewPage();
    const json = JSON.stringify(page);
    expect(json).toContain("Something went wrong");
  });
});
