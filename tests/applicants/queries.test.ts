import { beforeEach, describe, expect, it, vi } from "vitest";

// The supervisor reads filter by the company the caller passes, attach whether
// each student has a resume, put waiting applicants first, and count what the
// home screen shows. The database client is faked; what the query asks for is
// checked.

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
  chain.in = self;
  chain.eq = (column: string, value: unknown) => {
    call.filters.push([column, value]);
    return chain;
  };
  chain.then = (resolve: (value: unknown) => unknown) =>
    resolve({ data: results[table] ?? [], error: null });
  return chain;
}

vi.mock("@/lib/db/admin", () => ({ adminClient: () => ({ from: builder }) }));

const queries = await import("@/lib/applicants/queries");

function row(id: string, status: string, studentId: string) {
  return {
    id,
    status,
    created_at: "2026-11-02T00:00:00Z",
    student_id: studentId,
    student: { full_name: `Student ${studentId}`, student_number: `SN-${studentId}` },
    listing: { title: "Intern" },
  };
}

beforeEach(() => {
  calls.length = 0;
  for (const key of Object.keys(results)) delete results[key];
});

describe("getApplicantsForCompany", () => {
  it("asks only for applications to the given company's listings", async () => {
    await queries.getApplicantsForCompany("company-1");
    expect(calls.find((call) => call.table === "applications")?.filters).toEqual([
      ["listings.company_id", "company-1"],
    ]);
  });

  it("puts waiting applicants first and keeps the newest-first order inside each group", async () => {
    results.applications = [
      row("a1", "accepted", "s1"),
      row("a2", "applied", "s2"),
      row("a3", "rejected", "s3"),
      row("a4", "applied", "s4"),
    ];
    const result = await queries.getApplicantsForCompany("company-1");
    expect(result.ok && result.data.map((applicant) => applicant.id)).toEqual(["a2", "a4", "a1", "a3"]);
  });

  it("says whether each student has a resume", async () => {
    results.applications = [row("a1", "applied", "s1"), row("a2", "applied", "s2")];
    results.resumes = [{ student_id: "s2" }];
    const result = await queries.getApplicantsForCompany("company-1");
    expect(result.ok && result.data.map((applicant) => [applicant.studentId, applicant.hasResume])).toEqual([
      ["s1", false],
      ["s2", true],
    ]);
  });

  it("accepts a to-one embed returned as a one-item array", async () => {
    results.applications = [
      {
        ...row("a1", "applied", "s1"),
        student: [{ full_name: "Ana", student_number: "1" }],
        listing: [{ title: "Intern" }],
      },
    ];
    const result = await queries.getApplicantsForCompany("company-1");
    expect(result.ok && [result.data[0].studentName, result.data[0].listingTitle]).toEqual(["Ana", "Intern"]);
  });

  it("reports data of an unexpected shape as an error instead of passing it on", async () => {
    results.applications = [{ id: "a1" }];
    expect(await queries.getApplicantsForCompany("company-1")).toMatchObject({
      ok: false,
      error: { code: "unexpected" },
    });
  });
});

describe("getSupervisorSummary", () => {
  it("counts open listings, waiting applicants, and active students for the company", async () => {
    results.companies = [{ name: "Acme" }];
    results.listings = [{ status: "open" }, { status: "closed" }, { status: "open" }];
    results.applications = [row("a1", "applied", "s1"), row("a2", "accepted", "s2")];
    results.deployments = [{ id: "d1" }];
    expect(await queries.getSupervisorSummary("company-1")).toEqual({
      ok: true,
      data: { companyName: "Acme", openListings: 2, waitingApplicants: 1, activeStudents: 1 },
    });
    for (const table of ["listings", "deployments"]) {
      expect(calls.find((call) => call.table === table)?.filters).toEqual(
        expect.arrayContaining([["company_id", "company-1"]]),
      );
    }
    expect(calls.find((call) => call.table === "deployments")?.filters).toEqual(
      expect.arrayContaining([["status", "active"]]),
    );
  });
});
