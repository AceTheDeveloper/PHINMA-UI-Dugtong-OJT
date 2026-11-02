import { beforeEach, describe, expect, it, vi } from "vitest";

// The coordinator's reads ask only for the courses the caller passes, so a
// coordinator never sees another course's form. The database client is faked;
// what the query asks for and how it shapes the answer is checked.

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
  chain.in = (column: string, value: unknown) => {
    call.filters.push([`in:${column}`, value]);
    return chain;
  };
  chain.then = (resolve: (value: unknown) => unknown) =>
    resolve({ data: results[table] ?? [], error: null });
  return chain;
}

vi.mock("@/lib/db/admin", () => ({ adminClient: () => ({ from: builder }) }));

const queries = await import("@/lib/evaluations/queries");

function form(id: string, status: string, over: Record<string, unknown> = {}) {
  return {
    id,
    course_id: "c1",
    version: 1,
    status,
    published_at: status === "published" ? "2026-11-03T00:00:00Z" : null,
    criteria: [
      { position: 2, label: "Quality of work" },
      { position: 1, label: "Punctuality" },
    ],
    ...over,
  };
}

beforeEach(() => {
  calls.length = 0;
  for (const key of Object.keys(results)) delete results[key];
});

describe("getFormsForCourses", () => {
  it("asks for nothing when the coordinator has no course", async () => {
    expect(await queries.getFormsForCourses([])).toEqual({ ok: true, data: [] });
    expect(calls).toHaveLength(0);
  });

  it("asks only for the given courses, and only drafts and published forms", async () => {
    await queries.getFormsForCourses(["c1"]);
    expect(calls.find((call) => call.table === "courses")?.filters).toEqual([["in:id", ["c1"]]]);
    expect(calls.find((call) => call.table === "evaluation_forms")?.filters).toEqual([
      ["in:course_id", ["c1"]],
      ["in:status", ["draft", "published"]],
    ]);
  });

  it("puts the published form and the draft of each course side by side, criteria in order", async () => {
    results.courses = [{ id: "c1", code: "BSIT", name: "BS Information Technology" }];
    results.evaluation_forms = [
      form("f2", "draft", { version: 2 }),
      form("f1", "published"),
      form("fx", "published", { course_id: "other" }),
    ];
    const result = await queries.getFormsForCourses(["c1"]);
    expect(result.ok && result.data).toEqual([
      {
        courseId: "c1",
        courseLabel: "BSIT, BS Information Technology",
        published: {
          id: "f1",
          version: 1,
          status: "published",
          publishedAt: "2026-11-03T00:00:00Z",
          criteria: ["Punctuality", "Quality of work"],
        },
        draft: {
          id: "f2",
          version: 2,
          status: "draft",
          publishedAt: null,
          criteria: ["Punctuality", "Quality of work"],
        },
      },
    ]);
  });

  it("shows a course with no form yet", async () => {
    results.courses = [{ id: "c1", code: "BSIT", name: "BSIT" }];
    const result = await queries.getFormsForCourses(["c1"]);
    expect(result.ok && result.data[0]).toMatchObject({ published: null, draft: null });
  });

  it("fails with a typed error when a row does not match", async () => {
    results.courses = [{ id: "c1", code: "BSIT", name: "BSIT" }];
    results.evaluation_forms = [{ id: 1 }];
    expect(await queries.getFormsForCourses(["c1"])).toMatchObject({
      ok: false,
      error: { code: "unexpected" },
    });
  });
});
