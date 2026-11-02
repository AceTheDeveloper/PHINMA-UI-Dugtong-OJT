import { beforeEach, describe, expect, it, vi } from "vitest";

// The Companies screens list the school's partner companies but show only the
// coordinator's own course: its newest batch's students and hours, and the
// listings open to the course. The database client is faked; what each read asks
// for and how the answers are put together is checked.

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
  for (const name of ["eq", "in"]) {
    chain[name] = (column: string, value: unknown) => {
      call.filters.push([`${name}:${column}`, value]);
      return chain;
    };
  }
  chain.then = (resolve: (value: unknown) => unknown) =>
    failTable === table
      ? resolve({ data: null, error: { message: "boom" } })
      : resolve({ data: results[table] ?? [], error: null });
  return chain;
}

vi.mock("@/lib/db/admin", () => ({ adminClient: () => ({ from: builder }) }));

const { getCompaniesView, getCompanyView } = await import("@/lib/coordinator/company-queries");

const companyId = "00000000-0000-4000-8000-0000000000b1";
const otherCompanyId = "00000000-0000-4000-8000-0000000000b2";

function seed() {
  results.courses = [{ id: "c1", code: "BSIT" }];
  results.ojt_batches = [{ id: "b1", school_year: "2026-2027", required_hours: "300.00" }];
  results.companies = [
    { id: companyId, name: "Northwind", address: "Iloilo City", status: "active" },
    { id: otherCompanyId, name: "Bluepeak", address: null, status: "inactive" },
  ];
  results.supervisor_memberships = [
    { company_id: companyId, is_owner: true, user: { full_name: "Reyes, Ana", email: "ana@example.test", is_active: true } },
    { company_id: companyId, is_owner: false, user: { full_name: "Lim, Bo", email: "bo@example.test", is_active: false } },
  ];
  results.listings = [
    { id: "l1", company_id: companyId, title: "Web intern", status: "open", created_at: "2026-10-01T00:00:00Z" },
  ];
  results.deployment_hours = [
    { deployment_id: "d1", student_id: "s1", company_id: companyId, deployment_status: "active", approved_hours: "120.5" },
    { deployment_id: "d2", student_id: "s2", company_id: companyId, deployment_status: "ended", approved_hours: "40" },
  ];
  results.students = [
    { id: "s1", full_name: "DELA CRUZ, JUAN", student_number: "SN-1" },
    { id: "s2", full_name: "ABAD, MARIA", student_number: "SN-2" },
  ];
}

beforeEach(() => {
  calls.length = 0;
  failTable = null;
  seed();
});

describe("getCompaniesView", () => {
  it("is null without a course or a batch", async () => {
    expect(await getCompaniesView([])).toEqual({ ok: true, data: null });
    results.ojt_batches = [];
    expect(await getCompaniesView(["c1"])).toEqual({ ok: true, data: null });
  });

  it("limits the students and hours to the course's newest batch and its listings to the course", async () => {
    await getCompaniesView(["c1"]);
    expect(calls.find((call) => call.table === "courses")?.filters).toEqual([["in:id", ["c1"]]]);
    expect(calls.find((call) => call.table === "deployment_hours")?.filters).toEqual([["eq:ojt_batch_id", "b1"]]);
    expect(calls.find((call) => call.table === "listings")?.filters).toEqual([
      ["eq:status", "open"],
      ["eq:listing_courses.course_id", "c1"],
    ]);
  });

  it("lists every partner company with its contact, supervisors, listings, students, and hours", async () => {
    const result = await getCompaniesView(["c1"]);
    expect(result.ok && result.data?.companies).toEqual([
      {
        id: companyId,
        name: "Northwind",
        status: "active",
        ownerName: "Reyes, Ana",
        supervisors: 2,
        openListings: 1,
        activeStudents: 1,
        approvedHours: 160.5,
      },
      {
        id: otherCompanyId,
        name: "Bluepeak",
        status: "inactive",
        ownerName: null,
        supervisors: 0,
        openListings: 0,
        activeStudents: 0,
        approvedHours: 0,
      },
    ]);
  });

  it.each(["courses", "ojt_batches", "companies", "supervisor_memberships", "listings", "deployment_hours"])(
    "fails with a typed error when %s cannot be read",
    async (table) => {
      failTable = table;
      expect(await getCompaniesView(["c1"])).toMatchObject({ ok: false, error: { code: "unexpected" } });
    },
  );
});

describe("getCompanyView", () => {
  it("is null for an id that is not an id, asking nothing", async () => {
    expect(await getCompanyView(["c1"], "1; drop table companies")).toEqual({ ok: true, data: null });
    expect(calls).toHaveLength(0);
  });

  it("is null for a company that does not exist", async () => {
    results.companies = [];
    expect(await getCompanyView(["c1"], companyId)).toEqual({ ok: true, data: null });
  });

  it("reads the company's students only from the coordinator's batch", async () => {
    await getCompanyView(["c1"], companyId);
    expect(calls.find((call) => call.table === "deployment_hours")?.filters).toEqual([
      ["eq:ojt_batch_id", "b1"],
      ["eq:company_id", companyId],
    ]);
    expect(calls.find((call) => call.table === "students")?.filters).toEqual([
      ["eq:ojt_batch_id", "b1"],
      ["in:id", ["s1", "s2"]],
    ]);
  });

  it("shows the supervisors by name and email, the students by name, and the listings", async () => {
    const result = await getCompanyView(["c1"], companyId);
    expect(result.ok && result.data).toMatchObject({
      company: { name: "Northwind", address: "Iloilo City", status: "active" },
      supervisors: [
        { name: "Reyes, Ana", email: "ana@example.test", isOwner: true, isActive: true },
        { name: "Lim, Bo", email: "bo@example.test", isOwner: false, isActive: false },
      ],
      listings: [{ id: "l1", title: "Web intern", status: "open" }],
      students: [
        { name: "ABAD, MARIA", status: "ended", approvedHours: 40 },
        { name: "DELA CRUZ, JUAN", status: "active", approvedHours: 120.5 },
      ],
    });
  });

  it("leaves out a deployment whose student is not in the coordinator's batch", async () => {
    results.students = [{ id: "s1", full_name: "DELA CRUZ, JUAN", student_number: "SN-1" }];
    const result = await getCompanyView(["c1"], companyId);
    expect(result.ok && result.data?.students.map((student) => student.studentId)).toEqual(["s1"]);
  });

  it("asks for no students when nobody is placed", async () => {
    results.deployment_hours = [];
    await getCompanyView(["c1"], companyId);
    expect(calls.some((call) => call.table === "students")).toBe(false);
  });

  it.each(["companies", "supervisor_memberships", "listings", "deployment_hours", "students"])(
    "fails with a typed error when %s cannot be read",
    async (table) => {
      failTable = table;
      expect(await getCompanyView(["c1"], companyId)).toMatchObject({ ok: false, error: { code: "unexpected" } });
    },
  );
});
