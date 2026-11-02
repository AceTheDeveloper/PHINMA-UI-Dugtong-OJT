import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/roles";
import type { Session } from "@/lib/auth/session";

// The DTR's access rule, and its reads: only approved entries, oldest first, the
// supervisor who approved them (or the company's owner), the minutes with the
// break taken off. The database client is faked; what is asked for and how the
// answer is shaped is checked.

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
  const filter = (name: string) => (column: string, value: unknown) => {
    call.filters.push([`${name}:${column}`, value]);
    return chain;
  };
  chain.eq = filter("eq");
  chain.in = filter("in");
  chain.then = (resolve: (value: unknown) => unknown) =>
    resolve({ data: results[table] ?? [], error: null });
  return chain;
}

vi.mock("@/lib/db/admin", () => ({ adminClient: () => ({ from: builder }) }));

const { canDownloadDtr } = await import("@/lib/dtr/access");
const queries = await import("@/lib/dtr/queries");

function session(role: Role, over: Partial<Session> = {}): Session {
  return {
    userId: "user-1",
    clerkId: "clerk-1",
    role,
    studentId: null,
    courseIds: [],
    companyId: null,
    isCompanyOwner: false,
    hasConsent: true,
    ...over,
  };
}

const access = { studentId: "student-1", companyId: "company-1", courseId: "course-1" };

describe("canDownloadDtr", () => {
  it("lets the student have their own, and nobody else's", () => {
    expect(canDownloadDtr(session("student", { studentId: "student-1" }), access)).toBe(true);
    expect(canDownloadDtr(session("student", { studentId: "student-2" }), access)).toBe(false);
    expect(canDownloadDtr(session("student", { studentId: null }), access)).toBe(false);
  });

  it("lets a supervisor have their own company's students only", () => {
    expect(canDownloadDtr(session("supervisor", { companyId: "company-1" }), access)).toBe(true);
    expect(canDownloadDtr(session("supervisor", { companyId: "company-2" }), access)).toBe(false);
    expect(canDownloadDtr(session("supervisor", { companyId: null }), access)).toBe(false);
  });

  it("lets a coordinator have the students of their courses only", () => {
    expect(canDownloadDtr(session("coordinator", { courseIds: ["x", "course-1"] }), access)).toBe(true);
    expect(canDownloadDtr(session("coordinator", { courseIds: ["course-2"] }), access)).toBe(false);
    expect(canDownloadDtr(session("coordinator", { courseIds: [] }), access)).toBe(false);
  });

  it("lets the admin have any", () => {
    expect(canDownloadDtr(session("admin"), access)).toBe(true);
  });
});

const id = "00000000-0000-4000-8000-0000000000d1";

function seed() {
  results.deployments = [
    {
      id,
      company_id: "company-1",
      student: { id: "student-1", full_name: "DELA CRUZ, JUAN", student_number: "SN-1", course_id: "course-1" },
    },
  ];
  results.daily_logs = [
    { log_date: "2026-11-02", time_in: "2026-11-02T00:00:00Z", time_out: "2026-11-02T09:00:00Z", break_minutes: 60, approved_by: "sup-1" },
    { log_date: "2026-11-03", time_in: "2026-11-03T00:00:00Z", time_out: "2026-11-03T04:30:00Z", break_minutes: 0, approved_by: "sup-2" },
  ];
  results.users = [
    { id: "sup-1", full_name: "Supervisor Reyes" },
    { id: "sup-2", full_name: "Supervisor Santos" },
  ];
  results.supervisor_memberships = [{ user: { full_name: "Owner Cruz" } }];
}

beforeEach(() => {
  calls.length = 0;
  for (const key of Object.keys(results)) delete results[key];
  seed();
});

describe("entryMinutes", () => {
  it.each([
    ["2026-11-02T00:00:00Z", "2026-11-02T09:00:00Z", 0, 540],
    ["2026-11-02T00:00:00Z", "2026-11-02T09:00:00Z", 60, 480],
    ["2026-11-02T00:00:00Z", "2026-11-02T00:30:30Z", 0, 30.5],
    ["2026-11-02T00:00:00Z", "2026-11-02T00:30:00Z", 60, 0],
  ])("is %s to %s less %i minutes: %s", (timeIn, timeOut, breakMinutes, minutes) => {
    expect(queries.entryMinutes(timeIn, timeOut, breakMinutes)).toBe(minutes);
  });
});

describe("getDtr", () => {
  it("is null for an id that is not a uuid, without asking the database", async () => {
    expect(await queries.getDtr("nope")).toEqual({ ok: true, data: null });
    expect(calls).toHaveLength(0);
  });

  it("is null when the deployment does not exist", async () => {
    results.deployments = [];
    expect(await queries.getDtr(id)).toEqual({ ok: true, data: null });
  });

  it("asks only for this deployment's approved entries, oldest first", async () => {
    await queries.getDtr(id);
    expect(calls.find((call) => call.table === "deployments")?.filters).toEqual([["eq:id", id]]);
    expect(calls.find((call) => call.table === "daily_logs")?.filters).toEqual([
      ["eq:deployment_id", id],
      ["eq:status", "approved"],
    ]);
  });

  it("returns the student, the entries with their minutes, and what the route needs for access", async () => {
    const result = await queries.getDtr(id);
    expect(result.ok && result.data).toEqual({
      access: { studentId: "student-1", companyId: "company-1", courseId: "course-1" },
      data: {
        studentName: "DELA CRUZ, JUAN",
        studentNumber: "SN-1",
        supervisorName: "Supervisor Reyes, Supervisor Santos",
        entries: [
          { date: "2026-11-02", timeIn: "2026-11-02T00:00:00Z", timeOut: "2026-11-02T09:00:00Z", minutes: 480 },
          { date: "2026-11-03", timeIn: "2026-11-03T00:00:00Z", timeOut: "2026-11-03T04:30:00Z", minutes: 270 },
        ],
      },
    });
  });

  it("names the supervisors who approved the entries, each once", async () => {
    results.daily_logs = [
      { log_date: "2026-11-02", time_in: "2026-11-02T00:00:00Z", time_out: "2026-11-02T01:00:00Z", break_minutes: 0, approved_by: "sup-1" },
      { log_date: "2026-11-03", time_in: "2026-11-03T00:00:00Z", time_out: "2026-11-03T01:00:00Z", break_minutes: 0, approved_by: "sup-1" },
    ];
    const result = await queries.getDtr(id);
    expect(result.ok && result.data?.data.supervisorName).toBe("Supervisor Reyes");
    expect(calls.find((call) => call.table === "users")?.filters).toEqual([["in:id", ["sup-1"]]]);
  });

  it("falls back to the company's owner when nothing is approved yet", async () => {
    results.daily_logs = [];
    const result = await queries.getDtr(id);
    expect(result.ok && result.data?.data.supervisorName).toBe("Owner Cruz");
    expect(result.ok && result.data?.data.entries).toEqual([]);
    expect(calls.find((call) => call.table === "supervisor_memberships")?.filters).toEqual([
      ["eq:company_id", "company-1"],
    ]);
  });

  it("has no supervisor name when the company has no supervisor at all", async () => {
    results.daily_logs = [];
    results.supervisor_memberships = [];
    const result = await queries.getDtr(id);
    expect(result.ok && result.data?.data.supervisorName).toBeNull();
  });

  it("leaves out an approved entry that has no time out", async () => {
    results.daily_logs = [
      { log_date: "2026-11-02", time_in: "2026-11-02T00:00:00Z", time_out: null, break_minutes: 0, approved_by: "sup-1" },
    ];
    const result = await queries.getDtr(id);
    expect(result.ok && result.data?.data.entries).toEqual([]);
  });

  it("fails with a typed error when a row does not match", async () => {
    results.deployments = [{ id: 1 }];
    expect(await queries.getDtr(id)).toMatchObject({ ok: false, error: { code: "unexpected" } });
  });
});

describe("getDeploymentsOfStudent", () => {
  it("asks only for this student's deployments and names the company", async () => {
    results.deployments = [{ id: "d1", status: "active", company: { name: "Northwind" } }];
    const result = await queries.getDeploymentsOfStudent("student-1");
    expect(calls[0].filters).toEqual([["eq:student_id", "student-1"]]);
    expect(result.ok && result.data).toEqual([{ id: "d1", status: "active", companyName: "Northwind" }]);
  });
});
