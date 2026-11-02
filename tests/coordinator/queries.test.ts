import { beforeEach, describe, expect, it, vi } from "vitest";

// The dashboard reads are keyed by the coordinator's course and its newest OJT
// batch, so a coordinator never sees another course's students. The database
// client is faked; what the reads ask for, how they combine the answers, and the
// plain sentences of the activity list are checked.

vi.mock("server-only", () => ({}));

type Call = { table: string; filters: [string, unknown][] };
const calls: Call[] = [];
const rpcCalls: { name: string; args: unknown }[] = [];
const results: Record<string, unknown> = {};
let rpcResult: unknown = [];
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
  chain.lt = filter("lt");
  chain.in = filter("in");
  chain.then = (resolve: (value: unknown) => unknown) =>
    failTable === table
      ? resolve({ data: null, error: { message: "boom" } })
      : resolve({ data: results[table] ?? [], error: null });
  return chain;
}

vi.mock("@/lib/db/admin", () => ({
  adminClient: () => ({
    from: builder,
    rpc: (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      return Promise.resolve({ data: rpcResult, error: null });
    },
  }),
}));

// A fixed "today" for the days-waiting sums: 2026-11-03 in Manila.
vi.mock("@/lib/schedules/logic", async () => {
  const actual = await vi.importActual<typeof import("@/lib/schedules/logic")>("@/lib/schedules/logic");
  return { ...actual, manilaToday: () => "2026-11-03" };
});

const queries = await import("@/lib/coordinator/queries");

const batchId = "batch-1";

function seed() {
  results.courses = [
    { id: "course-1", code: "BSIT", name: "BS Information Technology", department: { code: "CITE", name: "College of IT" } },
  ];
  results.school_settings = [{ name: "PHINMA University of Iloilo" }];
  results.ojt_batches = [{ id: batchId, school_year: "2026-2027", required_hours: "300.00", stale_threshold_days: 3 }];
  results.students = [
    { id: "s1", full_name: "Ana Cruz", student_number: "SN-1" },
    { id: "s2", full_name: "Ben Dela", student_number: "SN-2" },
    { id: "s3", full_name: "Cara Lim", student_number: "SN-3" },
    { id: "s4", full_name: "Dino Ray", student_number: "SN-4" },
    { id: "s5", full_name: "Ella Sy", student_number: "SN-5" },
  ];
  results.deployments = [
    { id: "d1", student_id: "s1", company_id: "c1", status: "active" },
    { id: "d2", student_id: "s2", company_id: "c1", status: "active" },
    { id: "d3", student_id: "s3", company_id: "c2", status: "completed" },
  ];
  results.deployment_hours = [
    { deployment_id: "d1", approved_hours: "120.50" },
    { deployment_id: "d2", approved_hours: "300.00" },
    { deployment_id: "d3", approved_hours: "304.00" },
  ];
  results.deployment_activity = [
    { deployment_id: "d1", student_id: "s1", last_entry_date: "2026-11-02", pending_entries: 2 },
    { deployment_id: "d2", student_id: "s2", last_entry_date: "2026-10-30", pending_entries: 0 },
    { deployment_id: "d3", student_id: "s3", last_entry_date: "2026-10-20", pending_entries: 0 },
  ];
  results.applications = [{ student_id: "s4" }];
  results.companies = [
    { id: "c1", name: "Northwind" },
    { id: "c2", name: "Bluepeak" },
    { id: "c3", name: "Empty Co" },
  ];
  results.supervisor_memberships = [{ company_id: "c1" }, { company_id: "c1" }, { company_id: "c2" }];
  results.audit_log = [];
  rpcResult = [
    { week_start: "2026-10-20", hours: "0" },
    { week_start: "2026-10-27", hours: "36.50" },
  ];
}

beforeEach(() => {
  calls.length = 0;
  rpcCalls.length = 0;
  for (const key of Object.keys(results)) delete results[key];
  failTable = null;
  seed();
});

const filtersOf = (table: string) => calls.find((call) => call.table === table)?.filters;

describe("getDashboard", () => {
  it("shows nothing for a coordinator with no course, without asking the database", async () => {
    expect(await queries.getDashboard([])).toEqual({ ok: true, data: null });
    expect(calls).toHaveLength(0);
  });

  it("shows nothing when the course has no OJT batch yet", async () => {
    results.ojt_batches = [];
    expect(await queries.getDashboard(["course-1"])).toEqual({ ok: true, data: null });
  });

  it("asks only for the coordinator's courses, and only for the course's newest batch", async () => {
    await queries.getDashboard(["course-1", "course-2"]);
    expect(filtersOf("courses")).toEqual([["in:id", ["course-1", "course-2"]]]);
    expect(filtersOf("ojt_batches")).toEqual([["eq:course_id", "course-1"]]);
  });

  it("keys every read by the batch, so another batch's rows never come in", async () => {
    await queries.getDashboard(["course-1"]);
    const keyed: [string, string][] = [
      ["students", "eq:ojt_batch_id"],
      ["deployments", "eq:ojt_batch_id"],
      ["deployment_hours", "eq:ojt_batch_id"],
      ["deployment_activity", "eq:ojt_batch_id"],
    ];
    for (const [table, key] of keyed) {
      expect(filtersOf(table), table).toContainEqual([key, batchId]);
    }
    expect(filtersOf("applications")).toContainEqual(["eq:students.ojt_batch_id", batchId]);
    const logCalls = calls.filter((call) => call.table === "daily_logs");
    expect(logCalls).toHaveLength(2);
    for (const call of logCalls) expect(call.filters).toContainEqual(["eq:deployments.ojt_batch_id", batchId]);
    expect(rpcCalls).toEqual([{ name: "weekly_approved_hours", args: { p_batch_id: batchId, p_weeks: 8 } }]);
  });

  it("asks only for active students, and reads pending and open entries separately", async () => {
    await queries.getDashboard(["course-1"]);
    expect(filtersOf("students")).toContainEqual(["eq:is_active", true]);
    const [pending, open] = calls.filter((call) => call.table === "daily_logs");
    expect(pending.filters).toContainEqual(["eq:status", "pending"]);
    expect(open.filters).toContainEqual(["eq:status", "open"]);
    expect(open.filters).toContainEqual(["lt:log_date", "2026-11-03"]);
  });

  it("names the course, department, school, batch, required hours, and stale threshold as data", async () => {
    const result = await queries.getDashboard(["course-1"]);
    expect(result.ok && result.data?.course).toEqual({
      school: "PHINMA University of Iloilo",
      department: "College of IT",
      departmentShort: "CITE",
      course: "BS Information Technology",
      courseShort: "BSIT",
      batchLabel: "2026-2027",
      requiredHours: 300,
      staleThresholdDays: 3,
      asOf: "2026-11-03",
    });
  });

  it("works out each student's stage, hours, company, pending count, and last entry", async () => {
    const result = await queries.getDashboard(["course-1"]);
    const byId = Object.fromEntries((result.ok ? (result.data?.students ?? []) : []).map((s) => [s.id, s]));
    expect(byId.s1).toMatchObject({ status: "active", approvedHours: 120.5, companyId: "c1", pendingEntries: 2, lastEntryDate: "2026-11-02" });
    expect(byId.s2).toMatchObject({ status: "ready", approvedHours: 300, companyId: "c1" });
    expect(byId.s3).toMatchObject({ status: "completed", approvedHours: 304, companyId: "c2" });
    expect(byId.s4).toMatchObject({ status: "applying", companyId: null, approvedHours: 0, lastEntryDate: null });
    expect(byId.s5).toMatchObject({ status: "no-application", pendingEntries: 0 });
  });

  it("lists every active company with its supervisor count, including one with no students", async () => {
    const result = await queries.getDashboard(["course-1"]);
    expect(result.ok && result.data?.companies).toEqual([
      { id: "c1", name: "Northwind", supervisors: 2 },
      { id: "c2", name: "Bluepeak", supervisors: 1 },
      { id: "c3", name: "Empty Co", supervisors: 0 },
    ]);
  });

  it("counts the days a pending entry has waited, and keeps open entries from earlier days", async () => {
    results.daily_logs = [{ id: "l1", log_date: "2026-10-30", deployment: { student_id: "s1" } }];
    const result = await queries.getDashboard(["course-1"]);
    expect(result.ok && result.data?.pending).toEqual([
      { id: "l1", studentId: "s1", date: "2026-10-30", daysWaiting: 4 },
    ]);
    expect(result.ok && result.data?.open).toEqual([{ id: "l1", studentId: "s1", date: "2026-10-30" }]);
  });

  it("leaves out entries of a student who is not on the roster list (for example inactive)", async () => {
    results.daily_logs = [{ id: "l1", log_date: "2026-10-30", deployment: { student_id: "gone" } }];
    const result = await queries.getDashboard(["course-1"]);
    expect(result.ok && result.data?.pending).toEqual([]);
  });

  it("passes on the eight weeks from the database, as numbers", async () => {
    const result = await queries.getDashboard(["course-1"]);
    expect(result.ok && result.data?.weekly).toEqual([
      { weekStart: "2026-10-20", hours: 0 },
      { weekStart: "2026-10-27", hours: 36.5 },
    ]);
  });

  it("says how many more courses there are, since it shows the first", async () => {
    results.courses = [
      ...(results.courses as unknown[]),
      { id: "course-2", code: "BSCS", name: "BS Computer Science", department: { code: "CITE", name: "College of IT" } },
    ];
    const result = await queries.getDashboard(["course-1", "course-2"]);
    expect(result.ok && result.data?.otherCourses).toBe(1);
  });

  it.each(["students", "deployments", "deployment_hours", "deployment_activity", "applications", "daily_logs", "audit_log"])(
    "fails with a typed error when %s cannot be read, and never half a dashboard",
    async (table) => {
      failTable = table;
      const result = await queries.getDashboard(["course-1"]);
      expect(result).toMatchObject({ ok: false, error: { code: "unexpected" } });
    },
  );

  it("fails with a typed error when a row does not match", async () => {
    results.students = [{ id: 1 }];
    expect(await queries.getDashboard(["course-1"])).toMatchObject({ ok: false, error: { code: "unexpected" } });
  });
});

describe("daysBetween", () => {
  it.each([
    ["2026-10-30", "2026-11-03", 4],
    ["2026-11-03", "2026-11-03", 0],
    ["2026-12-30", "2027-01-02", 3],
    ["2026-02-27", "2026-03-02", 3],
    ["2026-11-04", "2026-11-03", -1],
  ])("%s to %s is %i days", (from, to, days) => {
    expect(queries.daysBetween(from, to)).toBe(days);
  });
});

describe("activityFrom", () => {
  const context = {
    batchId,
    deployments: [
      { id: "d1", student_id: "s1", company_id: "c1", status: "active" as const },
      { id: "d2", student_id: "s2", company_id: "c2", status: "completed" as const },
    ],
    students: [
      { id: "s1", full_name: "Ana Cruz", student_number: "1" },
      { id: "s2", full_name: "Ben Dela", student_number: "2" },
    ],
    companies: [
      { id: "c1", name: "Northwind" },
      { id: "c2", name: "Bluepeak" },
    ],
  };

  const row = (id: number, table_name: string, action: string, over: Partial<Parameters<typeof queries.activityFrom>[0][number]> = {}) => ({
    id,
    table_name,
    row_id: "x",
    action,
    old_value: null,
    new_value: null,
    created_at: `2026-11-0${id}T00:00:00Z`,
    ...over,
  });

  it("writes the four kinds of event as plain sentences, newest first as given", () => {
    const activity = queries.activityFrom(
      [
        row(5, "certifications", "insert", { new_value: { deployment_id: "d2" } }),
        row(4, "evaluations", "insert", { new_value: { deployment_id: "d2" } }),
        row(3, "deployments", "insert", { row_id: "d1" }),
        row(2, "ojt_batches", "update", { row_id: batchId, old_value: { required_hours: "486.00" }, new_value: { required_hours: "300.00" } }),
      ],
      context,
    );
    expect(activity.map((event) => event.text)).toEqual([
      "A certification was issued to Ben Dela.",
      "The supervisor submitted the evaluation of Ben Dela.",
      "Ana Cruz started at Northwind.",
      "Required hours changed from 486 to 300.",
    ]);
  });

  it("leaves out events of other courses and changes that are not worth a line", () => {
    const activity = queries.activityFrom(
      [
        row(1, "evaluations", "insert", { new_value: { deployment_id: "other-course" } }),
        row(2, "deployments", "insert", { row_id: "other-course" }),
        row(3, "ojt_batches", "update", { row_id: "other-batch", old_value: { required_hours: "1" }, new_value: { required_hours: "2" } }),
        row(4, "ojt_batches", "update", { row_id: batchId, old_value: { required_hours: "300.00", status: "planned" }, new_value: { required_hours: "300", status: "active" } }),
        row(5, "deployments", "update", { row_id: "d1" }),
        row(6, "evaluations", "delete", { new_value: null }),
      ],
      context,
    );
    expect(activity).toEqual([]);
  });

  it("keeps only the newest eight", () => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      row(index + 1, "deployments", "insert", { row_id: "d1", created_at: `2026-11-03T00:${String(index).padStart(2, "0")}:00Z` }),
    );
    expect(queries.activityFrom(rows, context)).toHaveLength(8);
  });
});
