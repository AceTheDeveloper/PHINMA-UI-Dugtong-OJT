import { beforeEach, describe, expect, it, vi } from "vitest";

// The supervisor reads filter by the company the caller passes, so a supervisor
// never sees another company's entries. They also split what needs a decision
// from what needs a time out. The database client is faked; what the query asks
// for and how it shapes the answer is checked.

vi.mock("server-only", () => ({}));

type Call = { table: string; filters: [string, unknown][] };
const calls: Call[] = [];
let results: unknown[][] = [];

function builder(table: string) {
  const call: Call = { table, filters: [] };
  calls.push(call);
  const index = calls.length - 1;
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
  chain.then = (resolve: (value: unknown) => unknown) =>
    resolve({ data: results[index] ?? [], error: null });
  return chain;
}

vi.mock("@/lib/db/admin", () => ({ adminClient: () => ({ from: builder }) }));

const queries = await import("@/lib/review/queries");

const deploymentId = "00000000-0000-4000-8000-0000000000d1";

function row(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    deployment_id: deploymentId,
    log_date: "2026-11-02",
    time_in: "2026-11-02T00:02:00+00:00",
    time_out: "2026-11-02T09:00:00+00:00",
    status: "pending",
    journal: "Worked",
    reject_reason: null,
    early_out_reason: null,
    correction_reason: null,
    reopen_reason: null,
    added_by: null,
    break_minutes: 0,
    schedule_start: "08:00:00",
    schedule_end: "17:00:00",
    deployment: {
      student: { full_name: "Ana Cruz", student_number: "2026-001" },
      company: { name: "Acme" },
    },
    ...over,
  };
}

beforeEach(() => {
  calls.length = 0;
  results = [];
});

describe("getReviewQueue", () => {
  it("asks only for the given company's pending entries and earlier open entries", async () => {
    await queries.getReviewQueue("company-1");
    const [pending, open] = calls;
    expect(pending.filters).toEqual([
      ["eq:deployments.company_id", "company-1"],
      ["eq:status", "pending"],
    ]);
    expect(open.filters.slice(0, 2)).toEqual([
      ["eq:deployments.company_id", "company-1"],
      ["eq:status", "open"],
    ]);
    expect(open.filters[2][0]).toBe("lt:log_date");
  });

  it("shapes the entries with the student and what the supervisor recorded", async () => {
    results = [
      [row("l1", { correction_reason: "Fixed", added_by: "sup-1" })],
      [row("l2", { status: "open", time_out: null })],
    ];
    const result = await queries.getReviewQueue("company-1");
    expect(result.ok && result.data.pending[0]).toMatchObject({
      id: "l1",
      deploymentId,
      studentName: "Ana Cruz",
      studentNumber: "2026-001",
      companyName: "Acme",
      correctionReason: "Fixed",
      addedBySupervisor: true,
      scheduleStart: "08:00",
      scheduleEnd: "17:00",
    });
    expect(result.ok && result.data.needsTimeOut.map((entry) => entry.id)).toEqual(["l2"]);
  });

  it("accepts embeds returned as one-item arrays", async () => {
    results = [
      [
        row("l1", {
          deployment: [{ student: [{ full_name: "Ben", student_number: "2" }], company: [{ name: "Beta" }] }],
        }),
      ],
    ];
    const result = await queries.getReviewQueue("company-1");
    expect(result.ok && [result.data.pending[0].studentName, result.data.pending[0].companyName]).toEqual([
      "Ben",
      "Beta",
    ]);
  });

  it("fails with a typed error when a row does not match", async () => {
    results = [[{ id: 1 }]];
    expect(await queries.getReviewQueue("company-1")).toMatchObject({
      ok: false,
      error: { code: "unexpected" },
    });
  });
});

describe("getEntriesForDeployment", () => {
  it("asks for the deployment only within the given company", async () => {
    await queries.getEntriesForDeployment("company-1", deploymentId);
    expect(calls[0].filters).toEqual([
      ["eq:deployments.company_id", "company-1"],
      ["eq:deployment_id", deploymentId],
    ]);
  });

  it("answers an id that is not a uuid with no entries, without asking the database", async () => {
    expect(await queries.getEntriesForDeployment("company-1", "nope")).toEqual({ ok: true, data: [] });
    expect(calls).toHaveLength(0);
  });

  it("returns every status", async () => {
    results = [[row("l1"), row("l2", { status: "approved" })]];
    const result = await queries.getEntriesForDeployment("company-1", deploymentId);
    expect(result.ok && result.data.map((entry) => entry.status)).toEqual(["pending", "approved"]);
  });
});
