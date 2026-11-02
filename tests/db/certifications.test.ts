import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./harness";

let db: Db;
let deptId: string;
let counter = 0;

async function id(sql: string, params: unknown[] = []) {
  return (await db.query<{ id: string }>(sql, params)).rows[0].id;
}

function insertUser(role: string, fullName?: string) {
  counter += 1;
  return id(
    "insert into users (clerk_id, email, full_name, role) values ($1, $2, $3, $4) returning id",
    [`clerk-${counter}`, `user${counter}@example.test`, fullName ?? `User ${counter}`, role],
  );
}

type Criterion = { id: string; label: string };
type Fixture = {
  courseId: string;
  coordinator: string;
  supervisor: string;
  companyId: string;
  studentUser: string;
  studentId: string;
  deployment: string;
  batchId: string;
  criteria: Criterion[];
};

// A course with a published form, a coordinator named "Coordinator Cruz", a
// supervisor named "Supervisor Reyes", and a student with 18 approved hours on
// two days against a batch that needs 18.
async function setup(): Promise<Fixture> {
  counter += 1;
  const courseId = await id(
    "insert into courses (department_id, code, name) values ($1, $2, $3) returning id",
    [deptId, `C${counter}`, `BS Course ${counter}`],
  );
  const batchId = await id(
    "insert into ojt_batches (course_id, school_year, required_hours) values ($1, '2026-2027', 18) returning id",
    [courseId],
  );
  const coordinator = await insertUser("coordinator", "Coordinator Cruz");
  await db.query("insert into coordinator_assignments (user_id, course_id) values ($1, $2)", [
    coordinator,
    courseId,
  ]);
  const form = await id("select create_evaluation_draft($1, $2) as id", [coordinator, courseId]);
  await db.query("select save_evaluation_draft($1, $2, $3::text[])", [coordinator, form, ["Punctuality", "Teamwork"]]);
  await db.query("select publish_evaluation_form($1, $2)", [coordinator, form]);
  const criteria = (
    await db.query<Criterion>("select id, label from evaluation_criteria where form_id = $1 order by position", [form])
  ).rows;

  const companyId = await id("insert into companies (name) values ($1) returning id", [`Acme ${counter}`]);
  const supervisor = await insertUser("supervisor", "Supervisor Reyes");
  await db.query(
    "insert into supervisor_memberships (user_id, company_id, is_owner) values ($1, $2, false)",
    [supervisor, companyId],
  );
  const studentUser = await insertUser("student");
  const studentId = await id(
    `insert into students (user_id, course_id, ojt_batch_id, student_number, email, full_name)
     values ($1, $2, $3, $4, $5, 'DELA CRUZ, JUAN') returning id`,
    [studentUser, courseId, batchId, `SN-${counter}`, `student${counter}@example.test`],
  );
  const deployment = await id(
    "insert into deployments (student_id, company_id, ojt_batch_id) values ($1, $2, $3) returning id",
    [studentId, companyId, batchId],
  );
  for (const day of [3, 2]) {
    await db.query(
      `insert into daily_logs (deployment_id, log_date, time_in, time_out, status, journal)
       values ($1, current_date - $2::int, now() - interval '10 hours', now() - interval '1 hour', 'approved', 'Worked')`,
      [deployment, day],
    );
  }
  return { courseId, coordinator, supervisor, companyId, studentUser, studentId, deployment, batchId, criteria };
}

function scores(criteria: Criterion[]) {
  return criteria.map((c) => ({ criterion_id: c.id, score: 4, comment: null }));
}

async function submit(f: Fixture) {
  const result = await db.query<{ id: string }>("select submit_evaluation($1, $2, $3::jsonb, null) as id", [
    f.supervisor,
    f.deployment,
    JSON.stringify(scores(f.criteria)),
  ]);
  return result.rows[0].id;
}

type Cert = {
  id: string;
  evaluation_id: string | null;
  status: string;
  student_name: string;
  student_number: string;
  course_name: string;
  company_name: string;
  supervisor_name: string;
  issuer_name: string;
  approved_hours: string;
  required_hours: string;
  start_date: string;
  end_date: string;
  heading: string;
  body: string;
  signatory_1_name: string;
  signatory_2_name: string;
  void_reason: string | null;
};

async function certs(deployment: string) {
  return (
    await db.query<Cert>(
      "select *, start_date::text, end_date::text from certifications where deployment_id = $1 order by issued_at, id",
      [deployment],
    )
  ).rows;
}

beforeAll(async () => {
  db = await createDb();
  deptId = await id(
    "insert into departments (code, name) values ('CITE', 'College of IT') returning id",
  );
});

afterAll(async () => {
  await db.close();
});

describe("templates", () => {
  it("exist for every course, with the placeholder signatories", async () => {
    const f = await setup();
    const template = (
      await db.query<{ signatory_1_name: string; signatory_2_name: string; heading: string }>(
        "select signatory_1_name, signatory_2_name, heading from certificate_templates where course_id = $1",
        [f.courseId],
      )
    ).rows;
    expect(template).toEqual([
      { signatory_1_name: "Person 1", signatory_2_name: "Person 2", heading: "Certificate of completion" },
    ]);
    const courses = await db.query<{ n: number }>("select count(*)::int as n from courses");
    const templates = await db.query<{ n: number }>("select count(*)::int as n from certificate_templates");
    expect(templates.rows[0].n).toBe(courses.rows[0].n);
  });

  it("lets the coordinator of the course name the signatories, audited", async () => {
    const f = await setup();
    await db.query("select save_certificate_template($1, $2, $3, $4, $5, $6)", [
      f.coordinator,
      f.courseId,
      "  Dr. Ana Reyes ",
      "OJT Coordinator",
      "Prof. Ben Santos",
      "Dean",
    ]);
    const template = await db.query<{ signatory_1_name: string; signatory_2_title: string }>(
      "select signatory_1_name, signatory_2_title from certificate_templates where course_id = $1",
      [f.courseId],
    );
    expect(template.rows[0]).toEqual({ signatory_1_name: "Dr. Ana Reyes", signatory_2_title: "Dean" });
    const audit = await db.query<{ actor_id: string; old_value: Record<string, string> }>(
      "select actor_id, old_value from audit_log where table_name = 'certificate_templates' and action = 'update' and actor_id = $1",
      [f.coordinator],
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].old_value.signatory_1_name).toBe("Person 1");
  });

  it.each(["student", "supervisor", "admin"])("refuses a %s", async (role) => {
    const f = await setup();
    const actor = await insertUser(role);
    await expect(
      db.query("select save_certificate_template($1, $2, 'A', 'B', 'C', 'D')", [actor, f.courseId]),
    ).rejects.toThrow(/forbidden/);
  });

  it("refuses a coordinator of another course", async () => {
    const f = await setup();
    const other = await setup();
    await expect(
      db.query("select save_certificate_template($1, $2, 'A', 'B', 'C', 'D')", [other.coordinator, f.courseId]),
    ).rejects.toThrow(/forbidden/);
  });

  it.each([
    ["an empty name", ["", "Title", "Name", "Title"], /needs a name and a title/],
    ["an empty title", ["Name", "  ", "Name", "Title"], /needs a name and a title/],
    ["a name over 100 characters", ["x".repeat(101), "Title", "Name", "Title"], /up to 100 characters/],
  ])("refuses %s and keeps the placeholders", async (_name, values, message) => {
    const f = await setup();
    await expect(
      db.query("select save_certificate_template($1, $2, $3, $4, $5, $6)", [f.coordinator, f.courseId, ...values]),
    ).rejects.toThrow(message);
    const template = await db.query<{ signatory_1_name: string }>(
      "select signatory_1_name from certificate_templates where course_id = $1",
      [f.courseId],
    );
    expect(template.rows[0].signatory_1_name).toBe("Person 1");
  });
});

describe("submitting an evaluation makes the certification", () => {
  it("creates exactly one issued certification with the facts as they are", async () => {
    const f = await setup();
    const evaluation = await submit(f);
    const [cert] = await certs(f.deployment);
    expect(await certs(f.deployment)).toHaveLength(1);
    expect(cert).toMatchObject({
      evaluation_id: evaluation,
      status: "issued",
      student_name: "DELA CRUZ, JUAN",
      course_name: expect.stringMatching(/^BS Course/),
      company_name: expect.stringMatching(/^Acme/),
      supervisor_name: "Supervisor Reyes",
      issuer_name: "Coordinator Cruz",
      heading: "Certificate of completion",
      signatory_1_name: "Person 1",
      signatory_2_name: "Person 2",
      void_reason: null,
    });
    expect(Number(cert.approved_hours)).toBe(18);
    expect(Number(cert.required_hours)).toBe(18);
    expect(cert.body).toContain("{student}");
    const days = await db.query<{ first: string; last: string }>(
      "select (current_date - 3)::text as first, (current_date - 2)::text as last",
    );
    expect(cert.start_date).toBe(days.rows[0].first);
    expect(cert.end_date).toBe(days.rows[0].last);
  });

  it("uses the template text of that moment", async () => {
    const f = await setup();
    await db.query("select save_certificate_template($1, $2, 'Dr. Ana Reyes', 'Coordinator', 'Prof. Ben Santos', 'Dean')", [
      f.coordinator,
      f.courseId,
    ]);
    await submit(f);
    const [cert] = await certs(f.deployment);
    expect(cert.signatory_1_name).toBe("Dr. Ana Reyes");
    expect(cert.signatory_2_name).toBe("Prof. Ben Santos");
  });

  it("never changes after the student, company, or template change", async () => {
    const f = await setup();
    await submit(f);
    await db.query("update students set full_name = 'RENAMED, STUDENT' where id = $1", [f.studentId]);
    await db.query("update companies set name = 'Renamed Company' where id = $1", [f.companyId]);
    await db.query("select save_certificate_template($1, $2, 'New One', 'T', 'New Two', 'T')", [
      f.coordinator,
      f.courseId,
    ]);
    const [cert] = await certs(f.deployment);
    expect(cert.student_name).toBe("DELA CRUZ, JUAN");
    expect(cert.company_name).toMatch(/^Acme/);
    expect(cert.signatory_1_name).toBe("Person 1");
  });

  it("says OJT coordinator when the course has no active coordinator", async () => {
    const f = await setup();
    await db.query("update users set is_active = false where id = $1", [f.coordinator]);
    // An inactive coordinator cannot publish, but the form is already published.
    await submit(f);
    expect((await certs(f.deployment))[0].issuer_name).toBe("OJT coordinator");
  });

  it("makes nothing when the evaluation fails", async () => {
    const f = await setup();
    await expect(
      db.query("select submit_evaluation($1, $2, '[]'::jsonb, null)", [f.supervisor, f.deployment]),
    ).rejects.toThrow(/rate every criterion/);
    expect(await certs(f.deployment)).toHaveLength(0);
  });

  it("records the certification in the audit log with the supervisor as the actor", async () => {
    const f = await setup();
    await submit(f);
    const [cert] = await certs(f.deployment);
    const audit = await db.query<{ actor_id: string; action: string }>(
      "select actor_id, action from audit_log where table_name = 'certifications' and row_id = $1",
      [cert.id],
    );
    expect(audit.rows).toEqual([{ actor_id: f.supervisor, action: "insert" }]);
  });
});

describe("a certification is locked", () => {
  it("rejects changes to its facts, and deletes", async () => {
    const f = await setup();
    await submit(f);
    await expect(
      db.query("update certifications set student_name = 'Edited' where deployment_id = $1", [f.deployment]),
    ).rejects.toThrow(/cannot be changed/);
    await expect(
      db.query("update certifications set approved_hours = 999 where deployment_id = $1", [f.deployment]),
    ).rejects.toThrow(/cannot be changed/);
    await expect(
      db.query("delete from certifications where deployment_id = $1", [f.deployment]),
    ).rejects.toThrow(/cannot be deleted/);
    expect((await certs(f.deployment))[0].student_name).toBe("DELA CRUZ, JUAN");
  });

  it("allows an issued one to be voided, but not a voided one to be changed back", async () => {
    const f = await setup();
    await submit(f);
    const [cert] = await certs(f.deployment);
    await db.query(
      "update certifications set status = 'voided', voided_at = now(), voided_by = $2, void_reason = 'Wrong' where id = $1",
      [cert.id, f.coordinator],
    );
    await expect(
      db.query("update certifications set status = 'issued', voided_at = null, void_reason = null where id = $1", [cert.id]),
    ).rejects.toThrow(/voided certification cannot be changed/);
    await expect(
      db.query("update certifications set void_reason = 'Other' where id = $1", [cert.id]),
    ).rejects.toThrow(/voided certification cannot be changed/);
  });

  it("refuses a voided state that is missing who, when, or why", async () => {
    const f = await setup();
    await submit(f);
    await expect(
      db.query("update certifications set status = 'voided' where deployment_id = $1", [f.deployment]),
    ).rejects.toThrow(/certifications_void_complete/);
  });
});

describe("admin_reopen_evaluation", () => {
  it("voids the certification, removes the evaluation, and returns the deployment to active", async () => {
    const f = await setup();
    const evaluation = await submit(f);
    const admin = await insertUser("admin");
    await db.query("select admin_reopen_evaluation($1, $2, $3)", [admin, evaluation, "  Rated the wrong student  "]);

    const [cert] = await certs(f.deployment);
    expect(cert).toMatchObject({
      status: "voided",
      void_reason: "Rated the wrong student",
      evaluation_id: null,
      student_name: "DELA CRUZ, JUAN",
    });
    expect((await db.query("select 1 from evaluations where id = $1", [evaluation])).rows).toHaveLength(0);
    expect((await db.query("select 1 from evaluation_scores where evaluation_id = $1", [evaluation])).rows).toHaveLength(0);
    const deployment = await db.query<{ status: string }>("select status from deployments where id = $1", [f.deployment]);
    expect(deployment.rows[0].status).toBe("active");
    // Hours and entries are untouched.
    const hours = await db.query<{ approved_hours: string }>(
      "select approved_hours from deployment_hours where deployment_id = $1",
      [f.deployment],
    );
    expect(Number(hours.rows[0].approved_hours)).toBe(18);
  });

  it("keeps what the evaluation and its scores were in the audit log, with the admin as the actor", async () => {
    const f = await setup();
    const evaluation = await submit(f);
    const admin = await insertUser("admin");
    await db.query("select admin_reopen_evaluation($1, $2, 'Mistake')", [admin, evaluation]);
    const deletes = await db.query<{ table_name: string; actor_id: string; old_value: Record<string, unknown> }>(
      "select table_name, actor_id, old_value from audit_log where action = 'delete' and table_name in ('evaluations', 'evaluation_scores') and (row_id = $1 or old_value ->> 'evaluation_id' = $1)",
      [evaluation],
    );
    expect(deletes.rows.filter((row) => row.table_name === "evaluations")).toHaveLength(1);
    expect(deletes.rows.filter((row) => row.table_name === "evaluation_scores")).toHaveLength(2);
    expect(deletes.rows.every((row) => row.actor_id === admin)).toBe(true);
    expect(deletes.rows.find((row) => row.table_name === "evaluation_scores")?.old_value).toHaveProperty("score", 4);
  });

  it("lets the supervisor submit a corrected evaluation, which makes a new certification", async () => {
    const f = await setup();
    const evaluation = await submit(f);
    const admin = await insertUser("admin");
    await db.query("select admin_reopen_evaluation($1, $2, 'Mistake')", [admin, evaluation]);
    await submit(f);
    const all = await certs(f.deployment);
    expect(all.map((cert) => cert.status)).toEqual(["voided", "issued"]);
    expect(all[1].evaluation_id).not.toBeNull();
  });

  it.each(["student", "supervisor", "coordinator"])("refuses a %s", async (role) => {
    const f = await setup();
    const evaluation = await submit(f);
    const actor = await insertUser(role);
    await expect(db.query("select admin_reopen_evaluation($1, $2, 'Why')", [actor, evaluation])).rejects.toThrow(
      /forbidden/,
    );
    expect((await certs(f.deployment))[0].status).toBe("issued");
  });

  it.each([null, "", "   "])("needs a reason (%j)", async (reason) => {
    const f = await setup();
    const evaluation = await submit(f);
    const admin = await insertUser("admin");
    await expect(db.query("select admin_reopen_evaluation($1, $2, $3)", [admin, evaluation, reason])).rejects.toThrow(
      /give a reason/,
    );
    expect((await certs(f.deployment))[0].status).toBe("issued");
  });

  it("refuses an evaluation that does not exist", async () => {
    const admin = await insertUser("admin");
    await expect(
      db.query("select admin_reopen_evaluation($1, '00000000-0000-4000-8000-0000000000ff', 'Why')", [admin]),
    ).rejects.toThrow(/not_found/);
  });

  it("refuses when the student already has another active deployment, and changes nothing", async () => {
    const f = await setup();
    const evaluation = await submit(f);
    const other = await id("insert into companies (name) values ('Other Co') returning id");
    await db.query("insert into deployments (student_id, company_id, ojt_batch_id) values ($1, $2, $3)", [
      f.studentId,
      other,
      f.batchId,
    ]);
    const admin = await insertUser("admin");
    await expect(db.query("select admin_reopen_evaluation($1, $2, 'Why')", [admin, evaluation])).rejects.toThrow(
      /another active deployment/,
    );
    expect((await certs(f.deployment))[0].status).toBe("issued");
    expect((await db.query("select 1 from evaluations where id = $1", [evaluation])).rows).toHaveLength(1);
  });

  it("is the only way to remove an evaluation: a direct delete is still refused", async () => {
    const f = await setup();
    const evaluation = await submit(f);
    await expect(db.query("delete from evaluations where id = $1", [evaluation])).rejects.toThrow(
      /cannot be changed or deleted/,
    );
  });
});

describe("tables are closed to the API roles", () => {
  it("shows no rows and cannot call the functions", async () => {
    const f = await setup();
    await submit(f);
    await db.exec("set role authenticated");
    try {
      expect((await db.query("select * from certifications")).rows).toHaveLength(0);
      expect((await db.query("select * from certificate_templates")).rows).toHaveLength(0);
      await expect(
        db.query("select save_certificate_template($1, $2, 'A', 'B', 'C', 'D')", [f.coordinator, f.courseId]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("select admin_reopen_evaluation($1, $2, 'Why')", [f.coordinator, f.deployment]),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });
});
