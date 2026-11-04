import { beforeEach, describe, expect, it, vi } from "vitest";

// The read behind the supervisor's CSV is keyed by the company id from the
// session and pages through every row (ticket-34). The database client is faked.

vi.mock("server-only", () => ({}));

type Call = { table: string; filters: [string, unknown][]; ranges: [number, number][] };
const calls: Call[] = [];
const results: Record<string, unknown[]> = {};
let failTable: string | null = null;

function builder(table: string) {
  const call: Call = { table, filters: [], ranges: [] };
  calls.push(call);
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.order = () => chain;
  chain.eq = (column: string, value: unknown) => {
    call.filters.push([`eq:${column}`, value]);
    return chain;
  };
  chain.range = (from: number, to: number) => {
    call.ranges.push([from, to]);
    return chain;
  };
  chain.then = (resolve: (value: unknown) => unknown) => {
    if (failTable === table) return resolve({ data: null, error: { message: "boom" } });
    const all = results[table] ?? [];
    const [from, to] = call.ranges[0] ?? [0, all.length];
    return resolve({ data: all.slice(from, to + 1), error: null });
  };
  return chain;
}

vi.mock("@/lib/db/admin", () => ({ adminClient: () => ({ from: builder }) }));

const { getCompanyExport } = await import("@/lib/supervisor/export-queries");

const companyId = "company-1";

function deployment(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    status: "active",
    created_at: "2026-10-01T01:00:00Z",
    student: { full_name: `Student ${id}`, student_number: `N-${id}`, course: { code: "BSIT" } },
    batch: { required_hours: "486.00" },
    ...over,
  };
}

beforeEach(() => {
  calls.length = 0;
  for (const key of Object.keys(results)) delete results[key];
  failTable = null;
  results.companies = [{ name: "Northwind" }];
  results.deployments = [deployment("d1"), deployment("d2", { status: "ended" })];
  results.deployment_hours = [{ deployment_id: "d1", approved_hours: "120.50" }];
  results.deployment_activity = [
    { deployment_id: "d1", last_entry_date: "2026-11-02", pending_entries: 2 },
    { deployment_id: "d2", last_entry_date: null, pending_entries: 0 },
  ];
});

const callsTo = (table: string) => calls.filter((call) => call.table === table);

describe("getCompanyExport", () => {
  it("reads only the session's company, in every table", async () => {
    await getCompanyExport(companyId);
    expect(callsTo("companies")[0].filters).toEqual([["eq:id", companyId]]);
    for (const table of ["deployments", "deployment_hours", "deployment_activity"]) {
      expect(callsTo(table)[0].filters).toEqual([["eq:company_id", companyId]]);
    }
  });

  it("joins approved hours, activity, course, and required hours per deployment", async () => {
    const result = await getCompanyExport(companyId);
    expect(result).toEqual({
      ok: true,
      data: {
        companyName: "Northwind",
        rows: [
          {
            studentName: "Student d1",
            studentNumber: "N-d1",
            courseCode: "BSIT",
            status: "active",
            startedAt: "2026-10-01T01:00:00Z",
            approvedHours: 120.5,
            requiredHours: 486,
            pendingEntries: 2,
            lastEntryDate: "2026-11-02",
          },
          {
            studentName: "Student d2",
            studentNumber: "N-d2",
            courseCode: "BSIT",
            status: "ended",
            startedAt: "2026-10-01T01:00:00Z",
            approvedHours: 0,
            requiredHours: 486,
            pendingEntries: 0,
            lastEntryDate: null,
          },
        ],
      },
    });
  });

  it("returns null for a company that does not exist", async () => {
    results.companies = [];
    expect(await getCompanyExport(companyId)).toEqual({ ok: true, data: null });
    expect(callsTo("deployments")).toHaveLength(0);
  });

  it("reads every page, so a company with more than 1000 deployments is not cut off", async () => {
    results.deployments = Array.from({ length: 2300 }, (_, i) => deployment(`d${i}`));
    const result = await getCompanyExport(companyId);
    expect(result.ok && result.data?.rows).toHaveLength(2300);
    expect(callsTo("deployments").map((call) => call.ranges[0])).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("asks for another page when a page is exactly full", async () => {
    results.deployments = Array.from({ length: 1000 }, (_, i) => deployment(`d${i}`));
    const result = await getCompanyExport(companyId);
    expect(result.ok && result.data?.rows).toHaveLength(1000);
    expect(callsTo("deployments")).toHaveLength(2);
  });

  it.each(["companies", "deployments", "deployment_hours", "deployment_activity"])(
    "passes on a failed read of %s as a typed result",
    async (table) => {
      failTable = table;
      expect(await getCompanyExport(companyId)).toMatchObject({
        ok: false,
        error: { code: "unexpected" },
      });
    },
  );

  it("refuses a row it cannot read instead of guessing", async () => {
    results.deployments = [{ id: "d1" }];
    expect(await getCompanyExport(companyId)).toMatchObject({ ok: false, error: { code: "unexpected" } });
  });
});
