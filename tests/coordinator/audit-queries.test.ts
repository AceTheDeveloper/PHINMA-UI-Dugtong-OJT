import { beforeEach, describe, expect, it, vi } from "vitest";

// The coordinator's Audit log reads only rows that can be tied to their own batch.
// The database client is faked; what is asked for and which rows become sentences
// is checked.

vi.mock("server-only", () => ({}));

type Call = { table: string; filters: [string, unknown][] };
const calls: Call[] = [];
const auditResults: unknown[][] = [];
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
  for (const name of ["eq", "in", "gte", "lt"]) {
    chain[name] = (column: string, value: unknown) => {
      call.filters.push([`${name}:${column}`, value]);
      return chain;
    };
  }
  chain.then = (resolve: (value: unknown) => unknown) => {
    if (failTable === table) return resolve({ data: null, error: { message: "boom" } });
    if (table === "audit_log") return resolve({ data: auditResults.shift() ?? [], error: null });
    return resolve({ data: results[table] ?? [], error: null });
  };
  return chain;
}

vi.mock("@/lib/db/admin", () => ({ adminClient: () => ({ from: builder }) }));

const { getAuditView } = await import("@/lib/coordinator/audit-queries");
const { parseAuditFilters } = await import("@/lib/coordinator/audit-filters");

const all = parseAuditFilters({});
const studentId = "00000000-0000-4000-8000-0000000000a1";

function audit(id: number, at: string, over: Record<string, unknown>) {
  return {
    id,
    table_name: "daily_logs",
    row_id: "l1",
    action: "update",
    old_value: { deployment_id: "d1", log_date: "2026-11-02", status: "pending", journal: "SECRET" },
    new_value: { deployment_id: "d1", log_date: "2026-11-02", status: "approved", journal: "SECRET" },
    actor_id: "u1",
    source: "app",
    created_at: at,
    ...over,
  };
}

beforeEach(() => {
  calls.length = 0;
  failTable = null;
  auditResults.length = 0;
  results.courses = [{ id: "c1", code: "BSIT" }];
  results.ojt_batches = [{ id: "b1", school_year: "2026-2027" }];
  results.students = [{ id: studentId, full_name: "DELA CRUZ, JUAN" }];
  results.deployments = [{ id: "d1", student_id: studentId, company: { name: "Northwind" } }];
  results.users = [{ id: "u1", full_name: "Reyes, Ana" }];
  // First audit read: daily log rows. Second: the other tables.
  auditResults.push(
    [
      audit(3, "2026-11-02T08:00:00Z", {}),
      audit(2, "2026-11-01T08:00:00Z", { new_value: { deployment_id: "elsewhere", status: "approved" }, old_value: { deployment_id: "elsewhere", status: "pending" } }),
    ],
    [
      {
        id: 4,
        table_name: "certifications",
        row_id: "x",
        action: "insert",
        old_value: null,
        new_value: { deployment_id: "d1" },
        actor_id: null,
        source: "database",
        created_at: "2026-11-03T08:00:00Z",
      },
    ],
  );
});

describe("getAuditView", () => {
  it("is null without a course or a batch", async () => {
    expect(await getAuditView([], all)).toEqual({ ok: true, data: null });
    results.ojt_batches = [];
    expect(await getAuditView(["c1"], all)).toEqual({ ok: true, data: null });
  });

  it("reads the batch's students and deployments, and only the entry and course-event audit rows", async () => {
    await getAuditView(["c1"], all);
    expect(calls.find((call) => call.table === "students")?.filters).toEqual([["eq:ojt_batch_id", "b1"]]);
    expect(calls.find((call) => call.table === "deployments")?.filters).toEqual([["eq:ojt_batch_id", "b1"]]);
    const auditCalls = calls.filter((call) => call.table === "audit_log");
    expect(auditCalls).toHaveLength(2);
    expect(auditCalls[0].filters).toEqual([
      ["eq:table_name", "daily_logs"],
      ["in:action", ["insert", "update"]],
    ]);
    expect(auditCalls[1].filters).toEqual([
      ["in:table_name", ["evaluations", "certifications", "deployments", "ojt_batches", "students"]],
    ]);
  });

  it("turns rows of the batch into sentences, newest first, and drops everything else", async () => {
    const result = await getAuditView(["c1"], all);
    const items = result.ok ? (result.data?.items ?? []) : [];
    expect(items.map((item) => item.text)).toEqual([
      "A certification was issued to DELA CRUZ, JUAN.",
      "Reyes, Ana approved DELA CRUZ, JUAN's entry of Mon, Nov 2.",
    ]);
    expect(JSON.stringify(items)).not.toContain("SECRET");
  });

  it("filters by kind and by student", async () => {
    const byKind = await getAuditView(["c1"], parseAuditFilters({ kind: "certifications" }));
    expect(byKind.ok && byKind.data?.items.map((item) => item.kind)).toEqual(["certifications"]);
    auditResults.push(
      [audit(3, "2026-11-02T08:00:00Z", {})],
      [],
    );
    const byStudent = await getAuditView(["c1"], parseAuditFilters({ student: "00000000-0000-4000-8000-0000000000ff" }));
    expect(byStudent.ok && byStudent.data?.items).toEqual([]);
  });

  it("turns a date range into Manila days on the audit reads", async () => {
    await getAuditView(["c1"], parseAuditFilters({ from: "2026-11-01", to: "2026-11-02" }));
    const first = calls.find((call) => call.table === "audit_log");
    expect(first?.filters).toEqual(
      expect.arrayContaining([
        ["gte:created_at", "2026-11-01T00:00:00+08:00"],
        ["lt:created_at", "2026-11-02T16:00:00.000Z"],
      ]),
    );
  });

  it("shows one page and says when there is more", async () => {
    auditResults.length = 0;
    auditResults.push(
      Array.from({ length: 60 }, (_, index) => audit(index + 1, `2026-10-${String((index % 28) + 1).padStart(2, "0")}T08:00:00Z`, {})),
      [],
    );
    const result = await getAuditView(["c1"], all);
    expect(result.ok && result.data?.items).toHaveLength(50);
    expect(result.ok && result.data?.more).toBe(true);
  });

  it("names a database edit without an actor", async () => {
    auditResults.length = 0;
    auditResults.push([], [
      { id: 9, table_name: "certifications", row_id: "x", action: "insert", old_value: null, new_value: { deployment_id: "d1" }, actor_id: null, source: "database", created_at: "2026-11-03T08:00:00Z" },
    ]);
    const result = await getAuditView(["c1"], all);
    expect(result.ok && result.data?.items[0].text).toBe("A certification was issued to DELA CRUZ, JUAN.");
  });

  it.each(["courses", "ojt_batches", "students", "deployments", "audit_log", "users"])(
    "fails with a typed error when %s cannot be read",
    async (table) => {
      failTable = table;
      expect(await getAuditView(["c1"], all)).toMatchObject({ ok: false, error: { code: "unexpected" } });
    },
  );
});
