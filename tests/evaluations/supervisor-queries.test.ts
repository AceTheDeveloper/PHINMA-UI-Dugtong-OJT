import { beforeEach, describe, expect, it, vi } from "vitest";

// The supervisor's evaluation reads filter by the company the caller passes, so
// a supervisor never sees another company's students or evaluations. They also
// decide who is ready. The database client is faked; what the query asks for and
// how it shapes the answer is checked.

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

const queries = await import("@/lib/evaluations/supervisor");

const id1 = "00000000-0000-4000-8000-0000000000d1";

function deployment(id: string, name: string, status = "active", required = "18.00") {
  return {
    id,
    status,
    student: { full_name: name, student_number: `SN-${id}`, course_id: "course-1" },
    batch: { required_hours: required },
  };
}

beforeEach(() => {
  calls.length = 0;
  for (const key of Object.keys(results)) delete results[key];
});

describe("getEvaluationQueue", () => {
  it("asks only for the given company's deployments, hours, evaluations, and pending entries", async () => {
    await queries.getEvaluationQueue("company-1");
    const filtersOf = (table: string) => calls.find((call) => call.table === table)?.filters;
    expect(filtersOf("deployments")).toEqual([["company_id", "company-1"]]);
    expect(filtersOf("deployment_hours")).toEqual([["company_id", "company-1"]]);
    expect(filtersOf("evaluations")).toEqual([["deployments.company_id", "company-1"]]);
    expect(filtersOf("daily_logs")).toEqual([
      ["deployments.company_id", "company-1"],
      ["status", "pending"],
    ]);
  });

  it("marks a student ready only at or above the required hours, and not once evaluated", async () => {
    results.deployments = [
      deployment("d1", "Below"),
      deployment("d2", "Exact"),
      deployment("d3", "Over"),
      deployment("d4", "Done", "completed"),
      deployment("d5", "Ended", "ended"),
    ];
    results.deployment_hours = [
      { deployment_id: "d1", approved_hours: "17.99" },
      { deployment_id: "d2", approved_hours: "18.00" },
      { deployment_id: "d3", approved_hours: "30.50" },
      { deployment_id: "d4", approved_hours: "20.00" },
      { deployment_id: "d5", approved_hours: "20.00" },
    ];
    results.evaluations = [{ deployment_id: "d4", submitted_at: "2026-11-03T00:00:00Z" }];
    const result = await queries.getEvaluationQueue("company-1");
    const byName = Object.fromEntries(
      (result.ok ? result.data : []).map((row) => [row.studentName, row]),
    );
    expect(byName.Below.ready).toBe(false);
    expect(byName.Exact.ready).toBe(true);
    expect(byName.Over.ready).toBe(true);
    expect(byName.Done).toMatchObject({ ready: false, evaluatedAt: "2026-11-03T00:00:00Z" });
    expect(byName.Ended.ready).toBe(false);
    expect(byName.Over.approvedHours).toBe(30.5);
  });

  it("lists ready students first, then by progress", async () => {
    results.deployments = [
      deployment("d1", "Low"),
      deployment("d2", "Ready"),
      deployment("d3", "Close"),
    ];
    results.deployment_hours = [
      { deployment_id: "d1", approved_hours: "2" },
      { deployment_id: "d2", approved_hours: "18" },
      { deployment_id: "d3", approved_hours: "15" },
    ];
    const result = await queries.getEvaluationQueue("company-1");
    expect(result.ok && result.data.map((row) => row.studentName)).toEqual(["Ready", "Close", "Low"]);
  });

  it("counts pending entries per student, and treats no hours as zero", async () => {
    results.deployments = [deployment("d1", "Ana"), deployment("d2", "Ben")];
    results.daily_logs = [{ deployment_id: "d1" }, { deployment_id: "d1" }, { deployment_id: "d2" }];
    const result = await queries.getEvaluationQueue("company-1");
    const byName = Object.fromEntries(
      (result.ok ? result.data : []).map((row) => [row.studentName, row]),
    );
    expect(byName.Ana).toMatchObject({ pendingEntries: 2, approvedHours: 0, ready: false });
    expect(byName.Ben.pendingEntries).toBe(1);
  });

  it("fails with a typed error when a row does not match", async () => {
    results.deployments = [{ id: 1 }];
    expect(await queries.getEvaluationQueue("company-1")).toMatchObject({
      ok: false,
      error: { code: "unexpected" },
    });
  });
});

describe("getEvaluationDetail", () => {
  it("asks for the deployment only within the given company", async () => {
    results.deployments = [deployment(id1, "Ana")];
    await queries.getEvaluationDetail("company-1", id1);
    expect(calls.find((call) => call.table === "deployments")?.filters).toEqual([
      ["id", id1],
      ["company_id", "company-1"],
    ]);
  });

  it("is not found for another company's deployment and for an id that is not a uuid", async () => {
    expect(await queries.getEvaluationDetail("company-1", id1)).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
    calls.length = 0;
    expect(await queries.getEvaluationDetail("company-1", "nope")).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
    expect(calls).toHaveLength(0);
  });

  it("returns the published form to rate against when nothing is submitted yet", async () => {
    results.deployments = [deployment(id1, "Ana")];
    results.deployment_hours = [{ deployment_id: id1, approved_hours: "18" }];
    results.evaluation_forms = [
      {
        id: "form-1",
        version: 3,
        criteria: [
          { id: "c2", position: 2, label: "Teamwork" },
          { id: "c1", position: 1, label: "Punctuality" },
        ],
      },
    ];
    const result = await queries.getEvaluationDetail("company-1", id1);
    expect(result.ok && result.data.form).toEqual({
      id: "form-1",
      version: 3,
      criteria: [
        { id: "c1", label: "Punctuality" },
        { id: "c2", label: "Teamwork" },
      ],
    });
    expect(calls.find((call) => call.table === "evaluation_forms")?.filters).toEqual([
      ["course_id", "course-1"],
      ["status", "published"],
    ]);
    expect(result.ok && result.data.submitted).toBeNull();
  });

  it("has no form when none is published", async () => {
    results.deployments = [deployment(id1, "Ana")];
    const result = await queries.getEvaluationDetail("company-1", id1);
    expect(result.ok && result.data.form).toBeNull();
  });

  it("returns the submitted evaluation with the scores in form order, and does not ask for a form", async () => {
    results.deployments = [deployment(id1, "Ana", "completed")];
    results.evaluations = [
      {
        submitted_at: "2026-11-03T00:00:00Z",
        overall_comment: "Good",
        approved_hours: "18.00",
        required_hours: "18.00",
        form: { version: 2 },
        scores: [
          { score: 3, comment: null, criterion: { label: "Teamwork", position: 2 } },
          { score: 5, comment: "Early", criterion: { label: "Punctuality", position: 1 } },
        ],
      },
    ];
    const result = await queries.getEvaluationDetail("company-1", id1);
    expect(result.ok && result.data.submitted).toEqual({
      submittedAt: "2026-11-03T00:00:00Z",
      overallComment: "Good",
      formVersion: 2,
      approvedHours: 18,
      requiredHours: 18,
      scores: [
        { label: "Punctuality", score: 5, comment: "Early" },
        { label: "Teamwork", score: 3, comment: null },
      ],
    });
    expect(result.ok && result.data.form).toBeNull();
    expect(calls.some((call) => call.table === "evaluation_forms")).toBe(false);
  });

  it("counts the pending entries", async () => {
    results.deployments = [deployment(id1, "Ana")];
    results.daily_logs = [{ id: "l1" }, { id: "l2" }];
    const result = await queries.getEvaluationDetail("company-1", id1);
    expect(result.ok && result.data.pendingEntries).toBe(2);
  });
});
