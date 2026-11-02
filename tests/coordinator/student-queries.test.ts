import { beforeEach, describe, expect, it, vi } from "vitest";

// The student screen reads only the coordinator's own courses: a student of
// another course is the same as one that does not exist. The database client is
// faked; what the reads ask for and how the answers are put together is checked.

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
  const filter = (name: string) => (column: string, value: unknown) => {
    call.filters.push([`${name}:${column}`, value]);
    return chain;
  };
  chain.eq = filter("eq");
  chain.in = filter("in");
  chain.then = (resolve: (value: unknown) => unknown) =>
    failTable === table
      ? resolve({ data: null, error: { message: "boom" } })
      : resolve({ data: results[table] ?? [], error: null });
  return chain;
}

vi.mock("@/lib/db/admin", () => ({ adminClient: () => ({ from: builder }) }));
vi.mock("@/lib/schedules/logic", async () => {
  const actual = await vi.importActual<typeof import("@/lib/schedules/logic")>("@/lib/schedules/logic");
  return { ...actual, manilaToday: () => "2026-11-03" };
});

const { getStudentView } = await import("@/lib/coordinator/student-queries");

const studentId = "00000000-0000-4000-8000-0000000000a1";

function seed() {
  results.students = [
    {
      id: studentId,
      full_name: "DELA CRUZ, JUAN",
      student_number: "SN-1",
      email: "juan@example.test",
      is_active: true,
      course: { code: "BSIT", name: "BS Information Technology" },
      batch: { school_year: "2026-2027", required_hours: "300.00" },
    },
  ];
  results.resumes = [{ student_id: studentId }];
  results.applications = [
    { id: "a1", status: "accepted", created_at: "2026-10-01T00:00:00Z", listing: { title: "Intern", company: { name: "Northwind" } } },
  ];
  results.deployments = [
    { id: "d2", status: "active", created_at: "2026-11-01T00:00:00Z", company: { name: "Bluepeak" } },
    { id: "d1", status: "ended", created_at: "2026-09-01T00:00:00Z", company: { name: "Northwind" } },
  ];
  results.deployment_hours = [
    { deployment_id: "d1", approved_hours: "85.00" },
    { deployment_id: "d2", approved_hours: "120.50" },
  ];
  results.daily_logs = [
    { id: "l3", deployment_id: "d2", log_date: "2026-11-02", time_in: "2026-11-02T00:00:00Z", time_out: "2026-11-02T09:00:00Z", break_minutes: 0, status: "pending", journal: "Worked", reject_reason: null, early_out_reason: null, correction_reason: null, reopen_reason: null, added_by: null },
    { id: "l2", deployment_id: "d2", log_date: "2026-11-01", time_in: "2026-11-01T00:00:00Z", time_out: "2026-11-01T09:00:00Z", break_minutes: 60, status: "approved", journal: "Done", reject_reason: null, early_out_reason: null, correction_reason: "Fixed the break", reopen_reason: null, added_by: "sup-1" },
    { id: "l1", deployment_id: "d1", log_date: "2026-09-02", time_in: "2026-09-02T00:00:00Z", time_out: null, break_minutes: 0, status: "open", journal: null, reject_reason: null, early_out_reason: null, correction_reason: null, reopen_reason: null, added_by: null },
  ];
  results.work_schedules = [
    {
      id: "w1",
      deployment_id: "d2",
      effective_from: "2026-11-01",
      days: [
        { weekday: 3, start_time: "08:00:00", end_time: "17:00:00" },
        { weekday: 1, start_time: "08:00:00", end_time: "17:00:00" },
      ],
    },
    { id: "w2", deployment_id: "d1", effective_from: "2999-01-01", days: [{ weekday: 1, start_time: "08:00:00", end_time: "17:00:00" }] },
  ];
  results.evaluations = [
    {
      deployment_id: "d1",
      submitted_at: "2026-10-01T00:00:00Z",
      overall_comment: "Good",
      approved_hours: "85.00",
      required_hours: "300.00",
      form: { version: 2 },
      scores: [
        { score: 3, comment: null, criterion: { label: "Teamwork", position: 2 } },
        { score: 5, comment: "Early", criterion: { label: "Punctuality", position: 1 } },
      ],
    },
  ];
  results.certifications = [{ id: "cert-1", deployment_id: "d1" }];
}

beforeEach(() => {
  calls.length = 0;
  for (const key of Object.keys(results)) delete results[key];
  failTable = null;
  seed();
});

const filtersOf = (table: string) => calls.find((call) => call.table === table)?.filters;

describe("getStudentView", () => {
  it("asks for nothing when the coordinator has no course or the id is not a uuid", async () => {
    expect(await getStudentView([], studentId)).toEqual({ ok: true, data: null });
    expect(await getStudentView(["course-1"], "nope")).toEqual({ ok: true, data: null });
    expect(calls).toHaveLength(0);
  });

  it("looks the student up only among the coordinator's courses", async () => {
    await getStudentView(["course-1", "course-2"], studentId);
    expect(filtersOf("students")).toEqual([
      ["eq:id", studentId],
      ["in:course_id", ["course-1", "course-2"]],
    ]);
  });

  it("is null, and reads nothing else, for a student of another course or one that does not exist", async () => {
    results.students = [];
    expect(await getStudentView(["course-1"], studentId)).toEqual({ ok: true, data: null });
    expect(calls.map((call) => call.table)).toEqual(["students"]);
  });

  it("keys every other read by this student or by their deployments", async () => {
    await getStudentView(["course-1"], studentId);
    for (const table of ["resumes", "applications", "deployments"]) {
      expect(filtersOf(table), table).toContainEqual(["eq:student_id", studentId]);
    }
    for (const table of ["deployment_hours", "daily_logs", "work_schedules", "evaluations", "certifications"]) {
      expect(filtersOf(table), table).toContainEqual(["in:deployment_id", ["d2", "d1"]]);
    }
    expect(filtersOf("certifications")).toContainEqual(["eq:status", "issued"]);
  });

  it("describes the student, their course, batch, and required hours", async () => {
    const result = await getStudentView(["course-1"], studentId);
    expect(result.ok && result.data?.profile).toEqual({
      id: studentId,
      name: "DELA CRUZ, JUAN",
      studentNumber: "SN-1",
      email: "juan@example.test",
      isActive: true,
      courseLabel: "BSIT, BS Information Technology",
      batchLabel: "2026-2027",
      requiredHours: 300,
    });
    expect(result.ok && result.data?.hasResume).toBe(true);
  });

  it("gives each deployment its own block, newest first, with hours, pending count, and downloads", async () => {
    const result = await getStudentView(["course-1"], studentId);
    const blocks = result.ok ? (result.data?.deployments ?? []) : [];
    expect(blocks.map((block) => block.id)).toEqual(["d2", "d1"]);
    expect(blocks[0]).toMatchObject({
      companyName: "Bluepeak",
      status: "active",
      approvedHours: 120.5,
      pendingEntries: 1,
      evaluation: null,
      certificationId: null,
    });
    expect(blocks[1]).toMatchObject({
      companyName: "Northwind",
      status: "ended",
      approvedHours: 85,
      pendingEntries: 0,
      certificationId: "cert-1",
    });
  });

  it("splits the entries by deployment, keeps every status, and marks one the supervisor added", async () => {
    const result = await getStudentView(["course-1"], studentId);
    const [current, older] = result.ok ? (result.data?.deployments ?? []) : [];
    expect(current.entries.map((entry) => [entry.id, entry.status])).toEqual([
      ["l3", "pending"],
      ["l2", "approved"],
    ]);
    expect(current.entries[1]).toMatchObject({ addedBySupervisor: true, correctionReason: "Fixed the break", breakMinutes: 60 });
    expect(current.entries[0].addedBySupervisor).toBe(false);
    expect(older.entries.map((entry) => entry.id)).toEqual(["l1"]);
    expect(older.entries[0].timeOut).toBeNull();
  });

  it("shows the schedule in force, and ignores one that has not started", async () => {
    const result = await getStudentView(["course-1"], studentId);
    const [current, older] = result.ok ? (result.data?.deployments ?? []) : [];
    expect(current.schedule).toEqual([{ days: "Mon, Wed", times: "8:00 AM to 5:00 PM" }]);
    expect(older.schedule).toBeNull();
  });

  it("returns the submitted evaluation with its scores in form order", async () => {
    const result = await getStudentView(["course-1"], studentId);
    const older = result.ok ? result.data?.deployments[1] : undefined;
    expect(older?.evaluation).toEqual({
      submittedAt: "2026-10-01T00:00:00Z",
      overallComment: "Good",
      formVersion: 2,
      approvedHours: 85,
      requiredHours: 300,
      scores: [
        { label: "Punctuality", score: 5, comment: "Early" },
        { label: "Teamwork", score: 3, comment: null },
      ],
    });
  });

  it("works out the stage from every deployment and application: a running deployment wins", async () => {
    const result = await getStudentView(["course-1"], studentId);
    expect(result.ok && result.data?.stage).toBe("active");
  });

  it("lists the applications with the company of each listing", async () => {
    const result = await getStudentView(["course-1"], studentId);
    expect(result.ok && result.data?.applications).toEqual([
      { id: "a1", status: "accepted", appliedAt: "2026-10-01T00:00:00Z", listingTitle: "Intern", companyName: "Northwind" },
    ]);
  });

  it("shows a student with nothing yet: no deployment, no application, no resume", async () => {
    for (const key of ["resumes", "applications", "deployments", "deployment_hours", "daily_logs", "work_schedules", "evaluations", "certifications"]) {
      results[key] = [];
    }
    const result = await getStudentView(["course-1"], studentId);
    expect(result.ok && result.data).toMatchObject({
      stage: "no-application",
      hasResume: false,
      applications: [],
      deployments: [],
    });
    // With no deployments there is nothing to look up by deployment.
    expect(calls.map((call) => call.table)).not.toContain("daily_logs");
  });

  it("still shows a deactivated student, marked inactive", async () => {
    (results.students as { is_active: boolean }[])[0].is_active = false;
    const result = await getStudentView(["course-1"], studentId);
    expect(result.ok && result.data?.profile.isActive).toBe(false);
  });

  it.each(["resumes", "applications", "deployments", "deployment_hours", "daily_logs", "work_schedules", "evaluations", "certifications"])(
    "fails with a typed error when %s cannot be read, never half a student",
    async (table) => {
      failTable = table;
      expect(await getStudentView(["course-1"], studentId)).toMatchObject({ ok: false, error: { code: "unexpected" } });
    },
  );

  it("fails with a typed error when a row does not match", async () => {
    results.students = [{ id: 1 }];
    expect(await getStudentView(["course-1"], studentId)).toMatchObject({ ok: false, error: { code: "unexpected" } });
  });
});
