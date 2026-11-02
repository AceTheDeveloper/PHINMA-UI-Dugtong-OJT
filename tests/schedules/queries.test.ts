import { beforeEach, describe, expect, it, vi } from "vitest";

// The Students reads filter by the company the caller passes, so a supervisor
// never sees another company's students. They also put active students first,
// attach hours, and pick the schedule in force. The database client is faked;
// what the query asks for is checked.

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

const queries = await import("@/lib/schedules/queries");

const id1 = "00000000-0000-4000-8000-0000000000d1";

function deployment(id: string, name: string, status = "active") {
  return {
    id,
    status,
    student: { full_name: name, student_number: `SN-${id}` },
    batch: { required_hours: "486.00" },
  };
}

function schedule(id: string, deploymentId: string, from: string, start = "08:00:00") {
  return {
    id,
    deployment_id: deploymentId,
    effective_from: from,
    days: [{ weekday: 1, start_time: start, end_time: "17:00:00" }],
  };
}

beforeEach(() => {
  calls.length = 0;
  for (const key of Object.keys(results)) delete results[key];
});

describe("getStudentsForCompany", () => {
  it("asks only for the given company's deployments, hours, and schedules", async () => {
    await queries.getStudentsForCompany("company-1");
    expect(calls.find((call) => call.table === "deployments")?.filters).toEqual([
      ["company_id", "company-1"],
    ]);
    expect(calls.find((call) => call.table === "deployment_hours")?.filters).toEqual([
      ["company_id", "company-1"],
    ]);
    expect(calls.find((call) => call.table === "work_schedules")?.filters).toEqual([
      ["deployments.company_id", "company-1"],
    ]);
  });

  it("puts active students first, then sorts by name", async () => {
    results.deployments = [
      deployment("d1", "Zed", "ended"),
      deployment("d2", "Mia"),
      deployment("d3", "Abe"),
    ];
    const result = await queries.getStudentsForCompany("company-1");
    expect(result.ok && result.data.map((row) => row.studentName)).toEqual(["Abe", "Mia", "Zed"]);
  });

  it("attaches approved hours, defaulting to zero, and the required hours", async () => {
    results.deployments = [deployment("d1", "Ana"), deployment("d2", "Ben")];
    results.deployment_hours = [{ deployment_id: "d1", approved_hours: "120.50" }];
    const result = await queries.getStudentsForCompany("company-1");
    expect(
      result.ok && result.data.map((row) => [row.approvedHours, row.requiredHours]),
    ).toEqual([
      [120.5, 486],
      [0, 486],
    ]);
  });

  it("summarizes the schedule in force and ignores one that has not started", async () => {
    results.deployments = [deployment("d1", "Ana"), deployment("d2", "Ben")];
    results.work_schedules = [
      schedule("s1", "d1", "2020-01-01", "08:00:00"),
      schedule("s2", "d1", "2020-06-01", "09:00:00"),
      schedule("s3", "d2", "2999-01-01"),
    ];
    const result = await queries.getStudentsForCompany("company-1");
    expect(result.ok && result.data.map((row) => row.scheduleSummary)).toEqual([
      "Mon, 9:00 AM to 5:00 PM",
      null,
    ]);
  });
});

describe("getStudentDetail", () => {
  it("asks for the deployment only within the given company", async () => {
    results.deployments = [deployment(id1, "Ana")];
    await queries.getStudentDetail("company-1", id1);
    expect(calls.find((call) => call.table === "deployments")?.filters).toEqual([
      ["id", id1],
      ["company_id", "company-1"],
    ]);
  });

  it("is not found when the deployment is not at the company", async () => {
    results.deployments = [];
    expect(await queries.getStudentDetail("company-1", id1)).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
  });

  it("is not found for an id that is not a uuid, without asking the database", async () => {
    expect(await queries.getStudentDetail("company-1", "nope")).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
    expect(calls).toHaveLength(0);
  });

  it("returns the schedules with times trimmed to hours and minutes, days in order", async () => {
    results.deployments = [deployment(id1, "Ana")];
    results.work_schedules = [
      {
        ...schedule("s1", id1, "2026-11-10"),
        days: [
          { weekday: 3, start_time: "09:00:00", end_time: "18:00:00" },
          { weekday: 1, start_time: "08:00:00", end_time: "17:00:00" },
        ],
      },
    ];
    const result = await queries.getStudentDetail("company-1", id1);
    expect(result.ok && result.data.schedules[0].days).toEqual([
      { weekday: 1, start: "08:00", end: "17:00" },
      { weekday: 3, start: "09:00", end: "18:00" },
    ]);
  });
});
