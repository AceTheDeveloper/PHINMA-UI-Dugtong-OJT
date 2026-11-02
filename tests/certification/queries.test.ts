import { beforeEach, describe, expect, it, vi } from "vitest";

// The certification reads ask only for what the caller passes, so a student sees
// only their own and a coordinator only their courses'. The database client is
// faked; what the query asks for and how it shapes the answer is checked.

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

const queries = await import("@/lib/certification/queries");

const id = "00000000-0000-4000-8000-0000000000e1";

function row(over: Record<string, unknown> = {}) {
  return {
    id,
    status: "issued",
    student_name: "DELA CRUZ, JUAN",
    student_number: "04-2122-000001",
    course_name: "BSIT",
    company_name: "Acme",
    approved_hours: "486.05",
    start_date: "2026-08-18",
    end_date: "2026-10-30",
    issued_at: "2026-11-03T02:00:00Z",
    student_id: "student-1",
    course_id: "course-1",
    supervisor_name: "Supervisor Reyes",
    issuer_name: "Coordinator Cruz",
    required_hours: "485.00",
    heading: "Certificate of completion",
    body: "Body",
    signatory_1_name: "Person 1",
    signatory_1_title: "Signatory",
    signatory_2_name: "Person 2",
    signatory_2_title: "Signatory",
    ...over,
  };
}

beforeEach(() => {
  calls.length = 0;
  for (const key of Object.keys(results)) delete results[key];
});

describe("getStudentCertification", () => {
  it("asks only for this student's issued certification", async () => {
    await queries.getStudentCertification("student-1");
    expect(calls[0].filters).toEqual([
      ["eq:student_id", "student-1"],
      ["eq:status", "issued"],
    ]);
  });

  it("is null when there is none, and shapes the one there is", async () => {
    expect(await queries.getStudentCertification("student-1")).toEqual({ ok: true, data: null });
    results.certifications = [row()];
    const result = await queries.getStudentCertification("student-1");
    expect(result.ok && result.data).toEqual({
      id,
      status: "issued",
      studentName: "DELA CRUZ, JUAN",
      studentNumber: "04-2122-000001",
      courseName: "BSIT",
      companyName: "Acme",
      approvedHours: 486.05,
      startDate: "2026-08-18",
      endDate: "2026-10-30",
      issuedAt: "2026-11-03T02:00:00Z",
    });
  });
});

describe("getCertificationsForCourses", () => {
  it("asks for nothing when the coordinator has no course", async () => {
    expect(await queries.getCertificationsForCourses([])).toEqual({ ok: true, data: [] });
    expect(calls).toHaveLength(0);
  });

  it("asks only for the given courses, and includes voided ones", async () => {
    results.certifications = [row(), row({ id: "x", status: "voided" })];
    const result = await queries.getCertificationsForCourses(["course-1"]);
    expect(calls[0].filters).toEqual([["in:course_id", ["course-1"]]]);
    expect(result.ok && result.data.map((cert) => cert.status)).toEqual(["issued", "voided"]);
  });
});

describe("getCertificationForPdf", () => {
  it("is null for an id that is not a uuid, without asking the database", async () => {
    expect(await queries.getCertificationForPdf("nope")).toEqual({ ok: true, data: null });
    expect(calls).toHaveLength(0);
  });

  it("is null when it does not exist", async () => {
    expect(await queries.getCertificationForPdf(id)).toEqual({ ok: true, data: null });
  });

  it("returns the snapshot for the PDF and what the route needs to decide access", async () => {
    results.certifications = [row()];
    const result = await queries.getCertificationForPdf(id);
    expect(calls[0].filters).toEqual([["eq:id", id]]);
    expect(result.ok && result.data).toEqual({
      access: { status: "issued", studentId: "student-1", courseId: "course-1" },
      data: {
        id,
        studentName: "DELA CRUZ, JUAN",
        studentNumber: "04-2122-000001",
        courseName: "BSIT",
        companyName: "Acme",
        supervisorName: "Supervisor Reyes",
        issuerName: "Coordinator Cruz",
        approvedHours: 486.05,
        requiredHours: 485,
        startDate: "2026-08-18",
        endDate: "2026-10-30",
        issuedAt: "2026-11-03T02:00:00Z",
        heading: "Certificate of completion",
        body: "Body",
        signatories: [
          { name: "Person 1", title: "Signatory" },
          { name: "Person 2", title: "Signatory" },
        ],
      },
    });
  });

  it("fails with a typed error when a row does not match", async () => {
    results.certifications = [{ id }];
    expect(await queries.getCertificationForPdf(id)).toMatchObject({
      ok: false,
      error: { code: "unexpected" },
    });
  });
});

describe("getTemplatesForCourses", () => {
  it("asks for nothing without a course, and only the given courses otherwise", async () => {
    expect(await queries.getTemplatesForCourses([])).toEqual({ ok: true, data: [] });
    expect(calls).toHaveLength(0);
    await queries.getTemplatesForCourses(["course-1"]);
    expect(calls.find((call) => call.table === "courses")?.filters).toEqual([["in:id", ["course-1"]]]);
    expect(calls.find((call) => call.table === "certificate_templates")?.filters).toEqual([
      ["in:course_id", ["course-1"]],
    ]);
  });

  it("pairs each course with its signatories", async () => {
    results.courses = [{ id: "course-1", code: "BSIT", name: "BS Information Technology" }];
    results.certificate_templates = [
      {
        course_id: "course-1",
        signatory_1_name: "Person 1",
        signatory_1_title: "Signatory",
        signatory_2_name: "Person 2",
        signatory_2_title: "Signatory",
      },
    ];
    const result = await queries.getTemplatesForCourses(["course-1"]);
    expect(result.ok && result.data).toEqual([
      {
        courseId: "course-1",
        courseLabel: "BSIT, BS Information Technology",
        signatories: [
          { name: "Person 1", title: "Signatory" },
          { name: "Person 2", title: "Signatory" },
        ],
      },
    ]);
  });
});
