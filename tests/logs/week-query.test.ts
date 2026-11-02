import { beforeEach, describe, expect, it, vi } from "vitest";

// The week strip reads only the signed-in student's own active deployment and the
// dates of the current school week. The database client is faked; what is asked
// for and how the answer becomes seven days is checked. "Today" is fixed to
// Tuesday 3 Nov 2026 in school time.

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
  chain.gte = filter("gte");
  chain.lte = filter("lte");
  chain.then = (resolve: (value: unknown) => unknown) =>
    failTable === table
      ? resolve({ data: null, error: { message: "boom" } })
      : resolve({ data: results[table] ?? [], error: null });
  return chain;
}

vi.mock("@/lib/db/admin", () => ({ adminClient: () => ({ from: builder }) }));
vi.mock("@/lib/schedules/logic", async () => {
  const actual = await vi.importActual<typeof import("@/lib/schedules/logic")>("@/lib/schedules/logic");
  return { ...actual, manilaToday: () => "2026-11-03" };
});

const { getWeekForStudent } = await import("@/lib/logs/queries");

const weekdaysMonToFri = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  start_time: "08:00:00",
  end_time: "17:00:00",
}));

function seed() {
  results.deployments = [{ id: "d1" }];
  results.work_schedules = [{ id: "w1", deployment_id: "d1", effective_from: "2026-10-01", days: weekdaysMonToFri }];
  results.daily_logs = [
    { log_date: "2026-11-02", time_in: "2026-11-02T00:00:00Z", time_out: "2026-11-02T09:00:00Z", break_minutes: 60, status: "approved" },
    { log_date: "2026-11-03", time_in: "2026-11-03T00:00:00Z", time_out: null, break_minutes: 0, status: "open" },
  ];
}

beforeEach(() => {
  calls.length = 0;
  for (const key of Object.keys(results)) delete results[key];
  failTable = null;
  seed();
});

describe("getWeekForStudent", () => {
  it("asks only for this student's active deployment and this week's dates", async () => {
    await getWeekForStudent("student-1");
    expect(calls.find((call) => call.table === "deployments")?.filters).toEqual([
      ["eq:student_id", "student-1"],
      ["eq:status", "active"],
    ]);
    expect(calls.find((call) => call.table === "daily_logs")?.filters).toEqual([
      ["eq:deployment_id", "d1"],
      ["gte:log_date", "2026-11-02"],
      ["lte:log_date", "2026-11-08"],
    ]);
  });

  it("is null, asking nothing more, when the student has no active deployment", async () => {
    results.deployments = [];
    expect(await getWeekForStudent("student-1")).toEqual({ ok: true, data: null });
    expect(calls.map((call) => call.table)).toEqual(["deployments"]);
  });

  it("shows seven days from the entries and the schedule's working days", async () => {
    const result = await getWeekForStudent("student-1");
    const days = result.ok ? (result.data?.days ?? []) : [];
    expect(days.map((day) => day.state)).toEqual([
      "approved", "open", "upcoming", "upcoming", "upcoming", "off", "off",
    ]);
    expect(days[0].minutes).toBe(480);
    expect(result.ok && result.data?.approvedMinutes).toBe(480);
  });

  it("treats every day as off before the schedule's first day", async () => {
    results.work_schedules = [{ id: "w1", deployment_id: "d1", effective_from: "2999-01-01", days: weekdaysMonToFri }];
    results.daily_logs = [];
    const result = await getWeekForStudent("student-1");
    expect(result.ok && result.data?.days.every((day) => day.state === "off")).toBe(true);
  });

  it("uses the schedule that applied on each day, when it changes in the week", async () => {
    results.work_schedules = [
      { id: "w1", deployment_id: "d1", effective_from: "2026-10-01", days: weekdaysMonToFri },
      { id: "w2", deployment_id: "d1", effective_from: "2026-11-04", days: [{ weekday: 6, start_time: "09:00:00", end_time: "13:00:00" }] },
    ];
    results.daily_logs = [];
    const result = await getWeekForStudent("student-1");
    // Mon and Tue under the old schedule; from Wednesday only Saturday works.
    expect(result.ok && result.data?.days.map((day) => day.state)).toEqual([
      "missed", "today", "off", "off", "off", "upcoming", "off",
    ]);
  });

  it.each(["deployments", "work_schedules", "daily_logs"])("fails with a typed error when %s cannot be read", async (table) => {
    failTable = table;
    expect(await getWeekForStudent("student-1")).toMatchObject({ ok: false, error: { code: "unexpected" } });
  });

  it("fails with a typed error when a row does not match", async () => {
    results.daily_logs = [{ log_date: 5 }];
    expect(await getWeekForStudent("student-1")).toMatchObject({ ok: false, error: { code: "unexpected" } });
  });
});
