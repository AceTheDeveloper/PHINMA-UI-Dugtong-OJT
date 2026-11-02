import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/roles";
import type { Session } from "@/lib/auth/session";
import { ok, fail } from "@/lib/result";

// The frame around every page asks for a little context: where the person works,
// the student's punch button, the supervisor's count. All of it is optional: when
// a read fails the page must still open. The database client is faked.

vi.mock("server-only", () => ({}));

type Call = { table: string; filters: [string, unknown][] };
const calls: Call[] = [];
const results: Record<string, unknown> = {};
let failTable: string | null = null;
let throwTable: string | null = null;

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
  chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
    if (throwTable === table) return reject(new Error("network down"));
    return failTable === table
      ? resolve({ data: null, error: { message: "boom" } })
      : resolve({ data: results[table] ?? [], error: null });
  };
  return chain;
}

vi.mock("@/lib/db/admin", () => ({ adminClient: () => ({ from: builder }) }));
vi.mock("@/lib/schedules/logic", async () => {
  const actual = await vi.importActual<typeof import("@/lib/schedules/logic")>("@/lib/schedules/logic");
  return { ...actual, manilaToday: () => "2026-11-03" };
});

const getTodayForStudent = vi.fn();
vi.mock("@/lib/logs/queries", () => ({ getTodayForStudent: (...args: unknown[]) => getTodayForStudent(...args) }));

const { getShellData } = await import("@/lib/layout/context");

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

beforeEach(() => {
  calls.length = 0;
  for (const key of Object.keys(results)) delete results[key];
  failTable = null;
  throwTable = null;
  getTodayForStudent.mockReset();
  getTodayForStudent.mockResolvedValue(ok({ companyName: "Acme", view: { kind: "ready", scheduleLabel: "8:00 AM to 5:00 PM" } }));
});

describe("every role", () => {
  it("shows today's date in school time, whoever it is", async () => {
    expect((await getShellData(session("admin"))).dateLabel).toBe("Tue, Nov 3");
  });
});

describe("a student", () => {
  const student = session("student", { studentId: "student-1" });

  it("shows the company they are placed at, and their course and batch", async () => {
    results.students = [{ course: { code: "BSIT" }, batch: { school_year: "2026-2027" } }];
    results.deployments = [{ company: { name: "Northwind" } }];
    const data = await getShellData(student);
    expect(data.context).toEqual({ primary: "Northwind", secondary: "BSIT, batch 2026-2027" });
    expect(calls.find((call) => call.table === "students")?.filters).toEqual([["eq:id", "student-1"]]);
    expect(calls.find((call) => call.table === "deployments")?.filters).toContainEqual(["eq:student_id", "student-1"]);
  });

  it("says there is no placement yet, and still names the course", async () => {
    results.students = [{ course: { code: "BSIT" }, batch: { school_year: "2026-2027" } }];
    const data = await getShellData(student);
    expect(data.context).toEqual({ primary: "No placement yet", secondary: "BSIT, batch 2026-2027" });
  });

  it("gets the punch button from the student's day", async () => {
    expect((await getShellData(student)).punch).toEqual({ kind: "time_in" });
    expect(getTodayForStudent).toHaveBeenCalledWith("student-1");
  });

  it("has no punch button when the day cannot be read, and the page still opens", async () => {
    getTodayForStudent.mockResolvedValue(fail("unexpected", "boom"));
    expect((await getShellData(student)).punch).toBeNull();
    getTodayForStudent.mockRejectedValue(new Error("network down"));
    expect((await getShellData(student)).punch).toBeNull();
  });

  it("still says there is no placement when only the student record cannot be read", async () => {
    failTable = "students";
    expect((await getShellData(student)).context).toEqual({ primary: "No placement yet", secondary: null });
  });

  it("has no context at all when neither read gives anything, and never throws", async () => {
    throwTable = "deployments";
    await expect(getShellData(student)).resolves.toMatchObject({ context: null });
  });

  it("asks nothing for an account with no student record", async () => {
    const data = await getShellData(session("student"));
    expect(data.context).toBeNull();
    expect(data.punch).toBeNull();
    expect(calls).toHaveLength(0);
  });
});

describe("a supervisor", () => {
  const supervisor = session("supervisor", { companyId: "company-1" });

  it("shows their company, and the entries waiting as a count on Approvals", async () => {
    results.companies = [{ name: "Northwind" }];
    results.deployment_activity = [{ pending_entries: 2 }, { pending_entries: 0 }, { pending_entries: 5 }];
    const data = await getShellData(supervisor);
    expect(data.context).toEqual({ primary: "Northwind", secondary: null });
    expect(data.badges).toEqual({ "/supervisor/approvals": 7 });
    expect(calls.find((call) => call.table === "deployment_activity")?.filters).toEqual([["eq:company_id", "company-1"]]);
  });

  it("shows no count when nothing is waiting", async () => {
    results.companies = [{ name: "Northwind" }];
    results.deployment_activity = [{ pending_entries: 0 }];
    expect((await getShellData(supervisor)).badges).toEqual({});
  });

  it("shows no count, and no error, when the count cannot be read", async () => {
    results.companies = [{ name: "Northwind" }];
    failTable = "deployment_activity";
    const data = await getShellData(supervisor);
    expect(data.badges).toEqual({});
    expect(data.context?.primary).toBe("Northwind");
  });

  it("asks nothing for an account with no company", async () => {
    const data = await getShellData(session("supervisor"));
    expect(data.context).toBeNull();
    expect(calls).toHaveLength(0);
  });
});

describe("a coordinator and the admin", () => {
  it("shows the coordinator's course and the newest batch, from their own courses only", async () => {
    results.courses = [{ id: "course-1", code: "BSIT" }];
    results.ojt_batches = [{ school_year: "2026-2027" }];
    const data = await getShellData(session("coordinator", { courseIds: ["course-1"] }));
    expect(data.context).toEqual({ primary: "BSIT", secondary: "batch 2026-2027" });
    expect(calls.find((call) => call.table === "courses")?.filters).toEqual([["in:id", ["course-1"]]]);
    expect(calls.find((call) => call.table === "ojt_batches")?.filters).toEqual([["eq:course_id", "course-1"]]);
  });

  it("shows only the course when it has no batch yet, and nothing with no course", async () => {
    results.courses = [{ id: "course-1", code: "BSIT" }];
    expect((await getShellData(session("coordinator", { courseIds: ["course-1"] }))).context).toEqual({
      primary: "BSIT",
      secondary: null,
    });
    calls.length = 0;
    expect((await getShellData(session("coordinator"))).context).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("shows the school to the admin", async () => {
    results.school_settings = [{ name: "PHINMA University of Iloilo" }];
    expect((await getShellData(session("admin"))).context).toEqual({
      primary: "PHINMA University of Iloilo",
      secondary: null,
    });
  });

  it("never throws, whatever fails", async () => {
    throwTable = "school_settings";
    await expect(getShellData(session("admin"))).resolves.toMatchObject({ context: null });
    throwTable = "courses";
    await expect(getShellData(session("coordinator", { courseIds: ["c"] }))).resolves.toMatchObject({ context: null });
  });
});
