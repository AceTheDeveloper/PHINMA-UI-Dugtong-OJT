import { beforeEach, describe, expect, it, vi } from "vitest";

// The student reads filter by the student the caller passes, so a student never
// sees another student's entries. The database client is faked; what the query
// asks for and how it shapes the answer is checked.

vi.mock("server-only", () => ({}));

type Call = { table: string; filters: [string, unknown][] };
const calls: Call[] = [];
const results: Record<string, unknown> = {};

function builder(table: string) {
  const call: Call = { table, filters: [] };
  calls.push(call);
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = self;
  chain.order = self;
  chain.limit = self;
  chain.eq = (column: string, value: unknown) => {
    call.filters.push([column, value]);
    return chain;
  };
  chain.then = (resolve: (value: unknown) => unknown) =>
    resolve({ data: results[table] ?? [], error: null });
  return chain;
}

vi.mock("@/lib/db/admin", () => ({ adminClient: () => ({ from: builder }) }));

const queries = await import("@/lib/logs/queries");

function log(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    log_date: "2026-11-02",
    time_in: "2026-11-02T00:02:00+00:00",
    time_out: null,
    status: "open",
    journal: null,
    reject_reason: null,
    early_out_reason: null,
    break_minutes: 0,
    schedule_start: "08:00:00",
    schedule_end: "17:00:00",
    deployment: { company: { name: "Acme" } },
    ...over,
  };
}

beforeEach(() => {
  calls.length = 0;
  for (const key of Object.keys(results)) delete results[key];
});

describe("getLogsForStudent", () => {
  it("asks only for the given student's entries", async () => {
    await queries.getLogsForStudent("student-1");
    expect(calls.find((call) => call.table === "daily_logs")?.filters).toEqual([
      ["deployments.student_id", "student-1"],
    ]);
  });

  it("shapes the rows and trims the schedule times to hours and minutes", async () => {
    results.daily_logs = [log("l1", { status: "rejected", reject_reason: "Too short" })];
    const result = await queries.getLogsForStudent("student-1");
    expect(result.ok && result.data[0]).toMatchObject({
      id: "l1",
      logDate: "2026-11-02",
      status: "rejected",
      rejectReason: "Too short",
      scheduleStart: "08:00",
      scheduleEnd: "17:00",
      companyName: "Acme",
    });
  });

  it("accepts embeds returned as one-item arrays and entries with no snapshot", async () => {
    results.daily_logs = [
      log("l1", {
        schedule_start: null,
        schedule_end: null,
        deployment: [{ company: [{ name: "Beta" }] }],
      }),
    ];
    const result = await queries.getLogsForStudent("student-1");
    expect(result.ok && [result.data[0].companyName, result.data[0].scheduleEnd]).toEqual([
      "Beta",
      null,
    ]);
  });

  it("fails with a typed error when a row does not match", async () => {
    results.daily_logs = [{ id: 1 }];
    expect(await queries.getLogsForStudent("student-1")).toMatchObject({
      ok: false,
      error: { code: "unexpected" },
    });
  });
});

describe("getTodayForStudent", () => {
  it("asks for the student's active deployment and today's entry only", async () => {
    await queries.getTodayForStudent("student-1");
    expect(calls.find((call) => call.table === "deployments")?.filters).toEqual([
      ["student_id", "student-1"],
      ["status", "active"],
    ]);
    const logCall = calls.find((call) => call.table === "daily_logs");
    expect(logCall?.filters[0]).toEqual(["deployments.student_id", "student-1"]);
    expect(logCall?.filters[1][0]).toBe("log_date");
  });

  it("offers nothing to a student with no deployment and no entry", async () => {
    expect(await queries.getTodayForStudent("student-1")).toEqual({
      ok: true,
      data: { companyName: null, view: { kind: "none" } },
    });
  });

  it("says there is no schedule when the deployment has none", async () => {
    results.deployments = [{ id: "d1", company: { name: "Acme" } }];
    const result = await queries.getTodayForStudent("student-1");
    expect(result.ok && result.data).toMatchObject({
      companyName: "Acme",
      view: { kind: "no_schedule" },
    });
  });

  it("shows today's entry first, even with no deployment", async () => {
    results.daily_logs = [log("l1")];
    const result = await queries.getTodayForStudent("student-1");
    expect(result.ok && result.data.view.kind).toBe("entry");
  });
});
