import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/roles";
import { parseLogFilters } from "@/lib/coordinator/log-filters";
import type { LogRow, LogsView } from "@/lib/coordinator/log-types";

vi.mock("server-only", () => ({}));

type Call = { table: string; head: boolean; filters: [string, unknown][]; range?: [number, number] };
const calls: Call[] = [];
const results: Record<string, unknown> = {};
let counts: number[] = [];
let failTable: string | null = null;

function builder(table: string) {
  const call: Call = { table, head: false, filters: [] };
  calls.push(call);
  const chain: Record<string, unknown> = {};
  chain.select = (_columns: string, options?: { head?: boolean }) => {
    call.head = options?.head === true;
    return chain;
  };
  chain.order = () => chain;
  chain.limit = () => chain;
  chain.range = (from: number, to: number) => {
    call.range = [from, to];
    return chain;
  };
  for (const name of ["eq", "in", "gte", "lte", "lt"]) {
    chain[name] = (column: string, value: unknown) => {
      call.filters.push([`${name}:${column}`, value]);
      return chain;
    };
  }
  chain.then = (resolve: (value: unknown) => unknown) => {
    if (failTable === table) return resolve({ data: null, error: { message: "database error" }, count: null });
    if (call.head) return resolve({ data: null, error: null, count: counts.shift() ?? 0 });
    return resolve({ data: results[table] ?? [], error: null, count: null });
  };
  return chain;
}

vi.mock("@/lib/db/admin", () => ({ adminClient: () => ({ from: builder }) }));
vi.mock("@/lib/schedules/logic", async () => {
  const actual = await vi.importActual<typeof import("@/lib/schedules/logic")>("@/lib/schedules/logic");
  return { ...actual, manilaToday: () => "2026-11-03" };
});

const mockRequireRole = vi.fn();
vi.mock("@/lib/auth/server", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const { getAdminLogsView } = await import("@/lib/admin/log-queries");
const AdminLogsPage = (await import("@/app/(app)/admin/logs/page")).default;
const { LogsScreen } = await import("@/components/coordinator/logs-screen");

const studentId = "00000000-0000-4000-8000-0000000000a1";
const companyId = "00000000-0000-4000-8000-0000000000b1";

function entry(over: Record<string, unknown> = {}) {
  return {
    id: "l1",
    log_date: "2026-11-02",
    time_in: "2026-11-02T00:00:00Z",
    time_out: "2026-11-02T09:00:00Z",
    break_minutes: 60,
    status: "approved",
    journal: "Worked on feature",
    reject_reason: null,
    early_out_reason: null,
    correction_reason: null,
    reopen_reason: null,
    added_by: null,
    deployment: {
      student: { id: studentId, full_name: "DELA CRUZ, JUAN", student_number: "SN-1" },
      company: { id: companyId, name: "Acme Corp" },
    },
    ...over,
  };
}

function seed() {
  results.students = [{ id: studentId, full_name: "DELA CRUZ, JUAN", student_number: "SN-1" }];
  results.companies = [{ id: companyId, name: "Acme Corp" }];
  results.daily_logs = [entry()];
  results.supervisor_memberships = [
    { company_id: companyId, is_owner: true, user: { full_name: "Alice Owner" } },
  ];
  counts = [10, 2, 1, 0, 1, 7]; // all, pending, stale, no-time-out, rejected, approved
}

describe("getAdminLogsView", () => {
  beforeEach(() => {
    calls.length = 0;
    failTable = null;
    seed();
  });

  it("queries daily logs across all courses and formats rows and counts", async () => {
    const filters = parseLogFilters({});
    const result = await getAdminLogsView(filters);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.course.courseShort).toBe("All courses");
    expect(result.data.total).toBe(10);
    expect(result.data.counts.approved).toBe(7);
    expect(result.data.counts.pending).toBe(2);
    expect(result.data.rows).toHaveLength(1);

    const row = result.data.rows[0];
    expect(row.id).toBe("l1");
    expect(row.studentName).toBe("DELA CRUZ, JUAN");
    expect(row.companyName).toBe("Acme Corp");
    expect(row.supervisors).toEqual(["Alice Owner"]);
    expect(row.status).toBe("approved");

    expect(result.data.students).toHaveLength(1);
    expect(result.data.companies).toHaveLength(1);
  });

  it("applies company and student filters when specified", async () => {
    const filters = parseLogFilters({ company: companyId, student: studentId });
    const result = await getAdminLogsView(filters);
    expect(result.ok).toBe(true);

    const dataCall = calls.find((c) => c.table === "daily_logs" && !c.head);
    expect(dataCall).toBeDefined();
    expect(dataCall?.filters).toContainEqual([`eq:deployments.company_id`, companyId]);
    expect(dataCall?.filters).toContainEqual([`eq:deployments.student_id`, studentId]);
  });

  it("returns database error when query fails", async () => {
    failTable = "students";
    const filters = parseLogFilters({});
    const result = await getAdminLogsView(filters);
    expect(result.ok).toBe(false);
  });
});

describe("AdminLogsPage access control", () => {
  beforeEach(() => {
    calls.length = 0;
    failTable = null;
    seed();
    mockRequireRole.mockReset();
  });

  it("allows admin access to /admin/logs and passes canReopen=true", async () => {
    mockRequireRole.mockResolvedValueOnce({
      userId: "u1",
      role: "admin" as Role,
      courseIds: [],
    });
    const page = await AdminLogsPage({ searchParams: Promise.resolve({}) });
    expect(page).toBeDefined();
    expect(mockRequireRole).toHaveBeenCalledWith(["admin"]);

    // The page renders a fragment: [0] PageHeader, [1] LogsScreen
    const screen = page.props.children[1];
    expect(screen.props.basePath).toBe("/admin/logs");
    expect(screen.props.studentBasePath).toBe("/admin/students");
    expect(screen.props.canReopen).toBe(true);
  });

  it("refuses non-admin roles", async () => {
    mockRequireRole.mockRejectedValueOnce(new Error("REDIRECT_NO_ACCESS"));
    await expect(AdminLogsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT_NO_ACCESS");
    expect(mockRequireRole).toHaveBeenCalledWith(["admin"]);
  });
});

describe("LogsScreen reopen rendering", () => {
  const dummyRow: LogRow = {
    id: "l1",
    logDate: "2026-11-02",
    timeIn: "2026-11-02T00:00:00Z",
    timeOut: "2026-11-02T09:00:00Z",
    breakMinutes: 60,
    status: "approved",
    journal: "Worked",
    rejectReason: null,
    earlyOutReason: null,
    correctionReason: null,
    reopenReason: null,
    addedBySupervisor: false,
    studentId,
    studentName: "Juan Dela Cruz",
    studentNumber: "SN-1",
    companyName: "Acme Corp",
    supervisors: ["Alice Owner"],
    daysWaiting: null,
    stale: false,
    noTimeOut: false,
  };

  const dummyView: LogsView = {
    course: { courseShort: "All courses", batchLabel: "All batches", staleThresholdDays: 3, asOf: "2026-11-03" },
    filters: parseLogFilters({}),
    total: 1,
    counts: { all: 1, pending: 0, stale: 0, "no-time-out": 0, rejected: 0, approved: 1 },
    rows: [dummyRow],
    students: [{ id: studentId, name: "Juan Dela Cruz" }],
    companies: [{ id: companyId, name: "Acme Corp" }],
  };

  it("renders reopen dialog trigger on approved row when canReopen is true", () => {
    const screen = LogsScreen({
      view: dummyView,
      basePath: "/admin/logs",
      studentBasePath: "/admin/students",
      canReopen: true,
    });
    // In React element tree, check row in list
    const ul = screen.props.children[3];
    const entryComponent = ul.props.children[0];
    expect(entryComponent.props.canReopen).toBe(true);
    expect(entryComponent.props.studentBasePath).toBe("/admin/students");
  });

  it("does not pass canReopen=true when canReopen defaults to false (coordinator view)", () => {
    const screen = LogsScreen({
      view: dummyView,
    });
    const ul = screen.props.children[3];
    const entryComponent = ul.props.children[0];
    expect(entryComponent.props.canReopen).toBe(false);
    expect(entryComponent.props.studentBasePath).toBe("/coordinator/students");
  });
});
