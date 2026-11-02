import { beforeEach, describe, expect, it, vi } from "vitest";

// The student reads filter by the student and course the caller passes, search
// in memory, and attach the student's own application status. The database
// client is faked; what the query asks for is checked.

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

const queries = await import("@/lib/applications/queries");
const schemas = await import("@/lib/applications/schemas");

const listings = [
  { id: "l1", title: "Web developer", description: "Build sites", created_at: "2026-11-01T00:00:00Z", company: { name: "Acme" } },
  { id: "l2", title: "Network intern", description: null, created_at: "2026-11-02T00:00:00Z", company: { name: "Globex" } },
];

beforeEach(() => {
  calls.length = 0;
  for (const key of Object.keys(results)) delete results[key];
  results.listings = listings;
  results.applications = [{ listing_id: "l2", status: "applied" }];
});

describe("getListingsForStudent", () => {
  it("asks only for open listings of active companies in the student's course", async () => {
    await queries.getListingsForStudent("student-1", "course-1", "");
    const listingCall = calls.find((call) => call.table === "listings");
    expect(listingCall?.filters).toEqual(
      expect.arrayContaining([
        ["status", "open"],
        ["companies.status", "active"],
        ["listing_courses.course_id", "course-1"],
      ]),
    );
  });

  it("reads applications for the student passed in, and no one else", async () => {
    await queries.getListingsForStudent("student-1", "course-1", "");
    const applicationCall = calls.find((call) => call.table === "applications");
    expect(applicationCall?.filters).toEqual([["student_id", "student-1"]]);
  });

  it("marks listings the student already applied to", async () => {
    const result = await queries.getListingsForStudent("student-1", "course-1", "");
    expect(result.ok && result.data.map((l) => [l.id, l.applicationStatus])).toEqual([
      ["l1", null],
      ["l2", "applied"],
    ]);
  });

  it("searches the title and the company name, ignoring case", async () => {
    const byTitle = await queries.getListingsForStudent("s", "c", "WEB");
    const byCompany = await queries.getListingsForStudent("s", "c", "globex");
    const none = await queries.getListingsForStudent("s", "c", "zzz");
    expect(byTitle.ok && byTitle.data.map((l) => l.id)).toEqual(["l1"]);
    expect(byCompany.ok && byCompany.data.map((l) => l.id)).toEqual(["l2"]);
    expect(none.ok && none.data).toEqual([]);
  });

  it("accepts a to-one embed returned as a one-item array", async () => {
    results.listings = [{ ...listings[0], company: [{ name: "Acme" }] }];
    const result = await queries.getListingsForStudent("s", "c", "");
    expect(result.ok && result.data[0].companyName).toBe("Acme");
  });

  it("reports data of an unexpected shape as an error instead of passing it on", async () => {
    results.listings = [{ id: "l1" }];
    expect(await queries.getListingsForStudent("s", "c", "")).toMatchObject({
      ok: false,
      error: { code: "unexpected" },
    });
  });
});

describe("getApplicationsForStudent and getStudentSummary", () => {
  it("reads only the given student's applications", async () => {
    results.applications = [
      {
        id: "a1",
        status: "applied",
        created_at: "2026-11-02T00:00:00Z",
        listing: { title: "Web developer", company: { name: "Acme" } },
      },
    ];
    const result = await queries.getApplicationsForStudent("student-1");
    expect(result.ok && result.data).toEqual([
      { id: "a1", status: "applied", listingTitle: "Web developer", companyName: "Acme", appliedAt: "2026-11-02T00:00:00Z" },
    ]);
    expect(calls[0]).toEqual({ table: "applications", filters: [["student_id", "student-1"]] });
  });

  it("counts applications and notes whether a resume exists", async () => {
    results.resumes = [{ student_id: "student-1" }];
    results.applications = [{ status: "applied" }, { status: "withdrawn" }, { status: "applied" }];
    expect(await queries.getStudentSummary("student-1")).toEqual({
      ok: true,
      data: { hasResume: true, openApplications: 2, totalApplications: 3 },
    });
    results.resumes = [];
    results.applications = [];
    expect(await queries.getStudentSummary("student-1")).toEqual({
      ok: true,
      data: { hasResume: false, openApplications: 0, totalApplications: 0 },
    });
  });
});

describe("cleanSearch", () => {
  it("trims, shortens, and drops anything that is not text", () => {
    expect(schemas.cleanSearch("  web  ")).toBe("web");
    expect(schemas.cleanSearch("x".repeat(500))).toHaveLength(schemas.maxSearchLength);
    expect(schemas.cleanSearch(["a", "b"])).toBe("");
    expect(schemas.cleanSearch(undefined)).toBe("");
  });
});
