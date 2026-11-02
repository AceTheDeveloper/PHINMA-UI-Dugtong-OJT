import { beforeEach, describe, expect, it, vi } from "vitest";

// The Daily logs screen reads only the coordinator's own batch. The database
// client is faked; what each read asks for, and how the answers become rows and
// counts, is checked. "Today" is fixed to 3 Nov 2026 in school time.

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
    if (failTable === table) return resolve({ data: null, error: { message: "boom" }, count: null });
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

const { getLogsView } = await import("@/lib/coordinator/log-queries");
const { parseLogFilters } = await import("@/lib/coordinator/log-filters");

const studentId = "00000000-0000-4000-8000-0000000000a1";
const companyId = "00000000-0000-4000-8000-0000000000b1";

function entry(over: Record<string, unknown>) {
  return {
    id: "l1",
    log_date: "2026-11-02",
    time_in: "2026-11-02T00:00:00Z",
    time_out: "2026-11-02T09:00:00Z",
    break_minutes: 60,
    status: "approved",
    journal: "Worked on the API",
    reject_reason: null,
    early_out_reason: null,
    correction_reason: null,
    reopen_reason: null,
    added_by: null,
    deployment: {
      student: { id: studentId, full_name: "DELA CRUZ, JUAN", student_number: "SN-1" },
      company: { id: companyId, name: "Northwind" },
    },
    ...over,
  };
}

function seed() {
  results.courses = [{ id: "c1", code: "BSIT" }];
  results.ojt_batches = [{ id: "b1", school_year: "2026-2027", stale_threshold_days: 3 }];
  results.students = [{ id: studentId, full_name: "DELA CRUZ, JUAN", student_number: "SN-1" }];
  results.deployments = [{ id: "d1", company: { id: companyId, name: "Northwind" } }];
  results.supervisor_memberships = [
    { company_id: companyId, is_owner: true, user: { full_name: "Reyes, Ana" } },
    { company_id: companyId, is_owner: false, user: { full_name: "Lim, Bo" } },
  ];
  results.daily_logs = [
    entry({ id: "l2", log_date: "2026-10-28", status: "pending" }),
    entry({ id: "l3", log_date: "2026-11-01", status: "pending" }),
    entry({ id: "l4", log_date: "2026-10-30", status: "open", time_out: null }),
    entry({ id: "l1" }),
  ];
  counts = [4, 2, 1, 1, 0, 1];
}

const all = parseLogFilters({});

beforeEach(() => {
  calls.length = 0;
  failTable = null;
  seed();
});

describe("getLogsView", () => {
  it("is null without a course, asking nothing", async () => {
    expect(await getLogsView([], all)).toEqual({ ok: true, data: null });
    expect(calls).toHaveLength(0);
  });

  it("is null without a batch", async () => {
    results.ojt_batches = [];
    expect(await getLogsView(["c1"], all)).toEqual({ ok: true, data: null });
  });

  it("reads every entry through the batch, the newest page first", async () => {
    await getLogsView(["c1"], all);
    expect(calls.find((call) => call.table === "courses")?.filters).toEqual([["in:id", ["c1"]]]);
    const page = calls.find((call) => call.table === "daily_logs" && !call.head);
    expect(page?.filters).toEqual([["eq:deployments.ojt_batch_id", "b1"]]);
    expect(page?.range).toEqual([0, 49]);
  });

  it("counts each status from the database, under the other filters", async () => {
    const filters = parseLogFilters({ company: companyId, from: "2026-10-01" });
    const result = await getLogsView(["c1"], filters);
    expect(result.ok && result.data?.counts).toEqual({
      all: 4,
      pending: 2,
      stale: 1,
      "no-time-out": 1,
      rejected: 0,
      approved: 1,
    });
    const heads = calls.filter((call) => call.table === "daily_logs" && call.head);
    expect(heads).toHaveLength(6);
    for (const call of heads) {
      expect(call.filters).toEqual(
        expect.arrayContaining([
          ["eq:deployments.ojt_batch_id", "b1"],
          ["eq:deployments.company_id", companyId],
          ["gte:log_date", "2026-10-01"],
        ]),
      );
    }
    // Stale: pending and dated on or before 30 Oct (more than 3 days waiting).
    expect(heads[2].filters).toEqual(
      expect.arrayContaining([
        ["eq:status", "pending"],
        ["lte:log_date", "2026-10-30"],
      ]),
    );
    // No time out: open, on an earlier day.
    expect(heads[3].filters).toEqual(
      expect.arrayContaining([
        ["eq:status", "open"],
        ["lt:log_date", "2026-11-03"],
      ]),
    );
  });

  it("applies the status, student, and date filters to the page", async () => {
    const filters = parseLogFilters({ status: "stale", student: studentId, to: "2026-11-02", shown: "100" });
    await getLogsView(["c1"], filters);
    const page = calls.find((call) => call.table === "daily_logs" && !call.head);
    expect(page?.filters).toEqual(
      expect.arrayContaining([
        ["eq:deployments.student_id", studentId],
        ["lte:log_date", "2026-11-02"],
        ["eq:status", "pending"],
        ["lte:log_date", "2026-10-30"],
      ]),
    );
    expect(page?.range).toEqual([0, 99]);
  });

  it("marks stale and never-timed-out entries and names who can act", async () => {
    const result = await getLogsView(["c1"], all);
    const rows = result.ok ? (result.data?.rows ?? []) : [];
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
    expect(byId.l2).toMatchObject({ daysWaiting: 6, stale: true, noTimeOut: false });
    expect(byId.l3).toMatchObject({ daysWaiting: 2, stale: false });
    expect(byId.l4).toMatchObject({ daysWaiting: null, stale: false, noTimeOut: true });
    expect(byId.l1).toMatchObject({ daysWaiting: null, stale: false, noTimeOut: false });
    expect(byId.l2.supervisors).toEqual(["Reyes, Ana", "Lim, Bo"]);
    expect(result.ok && result.data?.total).toBe(4);
  });

  it("marks an entry the supervisor added", async () => {
    results.daily_logs = [entry({ added_by: "u1", correction_reason: "Forgot to time in" })];
    const result = await getLogsView(["c1"], all);
    expect(result.ok && result.data?.rows[0]).toMatchObject({ addedBySupervisor: true });
  });

  it("lists the batch's students and companies for the filters", async () => {
    const result = await getLogsView(["c1"], all);
    expect(result.ok && result.data?.students).toEqual([{ id: studentId, name: "DELA CRUZ, JUAN" }]);
    expect(result.ok && result.data?.companies).toEqual([{ id: companyId, name: "Northwind" }]);
  });

  it("asks for no supervisors when the page is empty", async () => {
    results.daily_logs = [];
    await getLogsView(["c1"], all);
    expect(calls.some((call) => call.table === "supervisor_memberships")).toBe(false);
  });

  it.each(["courses", "ojt_batches", "students", "deployments", "daily_logs", "supervisor_memberships"])(
    "fails with a typed error when %s cannot be read",
    async (table) => {
      failTable = table;
      expect(await getLogsView(["c1"], all)).toMatchObject({ ok: false, error: { code: "unexpected" } });
    },
  );

  it("fails with a typed error when a row does not match", async () => {
    results.daily_logs = [{ id: 5 }];
    expect(await getLogsView(["c1"], all)).toMatchObject({ ok: false, error: { code: "unexpected" } });
  });
});
