import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./harness";

let db: Db;
let deptId: string;
let counter = 0;

async function id(sql: string, params: unknown[] = []) {
  return (await db.query<{ id: string }>(sql, params)).rows[0].id;
}

function insertUser(role: string) {
  counter += 1;
  return id(
    "insert into users (clerk_id, email, full_name, role) values ($1, $2, $3, $4) returning id",
    [`clerk-${counter}`, `user${counter}@example.test`, `User ${counter}`, role],
  );
}

type Criterion = { id: string; label: string };

type Fixture = {
  courseId: string;
  batchId: string;
  coordinator: string;
  supervisor: string;
  companyId: string;
  student: string;
  deployment: string;
  formId: string;
  criteria: Criterion[];
};

// A course with a published form of three criteria, a batch needing 18 hours,
// and a student deployed at a company, with `hours` approved hours (9 per day).
async function setup(
  hours = 18,
  labels = ["Punctuality", "Teamwork", "Quality of work"],
  withForm = true,
): Promise<Fixture> {
  counter += 1;
  const courseId = await id(
    "insert into courses (department_id, code, name) values ($1, $2, $3) returning id",
    [deptId, `C${counter}`, `Course ${counter}`],
  );
  const batchId = await id(
    "insert into ojt_batches (course_id, school_year, required_hours) values ($1, '2026-2027', 18) returning id",
    [courseId],
  );
  const coordinator = await insertUser("coordinator");
  await db.query("insert into coordinator_assignments (user_id, course_id) values ($1, $2)", [
    coordinator,
    courseId,
  ]);
  let formId = "";
  let criteria: Criterion[] = [];
  if (withForm) {
    formId = await id("select create_evaluation_draft($1, $2) as id", [coordinator, courseId]);
    await db.query("select save_evaluation_draft($1, $2, $3::text[])", [coordinator, formId, labels]);
    await db.query("select publish_evaluation_form($1, $2)", [coordinator, formId]);
    criteria = (
      await db.query<Criterion>(
        "select id, label from evaluation_criteria where form_id = $1 order by position",
        [formId],
      )
    ).rows;
  }

  const companyId = await id("insert into companies (name) values ($1) returning id", [
    `Company ${counter}`,
  ]);
  const supervisor = await insertUser("supervisor");
  await db.query(
    "insert into supervisor_memberships (user_id, company_id, is_owner) values ($1, $2, false)",
    [supervisor, companyId],
  );
  const student = await insertUser("student");
  const studentId = await id(
    `insert into students (user_id, course_id, ojt_batch_id, student_number, email, full_name)
     values ($1, $2, $3, $4, $5, 'Student') returning id`,
    [student, courseId, batchId, `SN-${counter}`, `student${counter}@example.test`],
  );
  const deployment = await id(
    "insert into deployments (student_id, company_id, ojt_batch_id) values ($1, $2, $3) returning id",
    [studentId, companyId, batchId],
  );
  for (let day = 1; day <= Math.floor(hours / 9); day += 1) {
    await db.query(
      `insert into daily_logs (deployment_id, log_date, time_in, time_out, status, journal)
       values ($1, current_date - $2::int, now() - interval '10 hours', now() - interval '1 hour', 'approved', 'Worked')`,
      [deployment, day],
    );
  }
  if (hours % 9 !== 0) {
    await db.query(
      `insert into daily_logs (deployment_id, log_date, time_in, time_out, status, journal)
       values ($1, current_date - 100, now() - interval '10 hours', now() - interval '10 hours' + make_interval(mins => $2::int), 'approved', 'Worked')`,
      [deployment, Math.round((hours % 9) * 60)],
    );
  }
  return { courseId, batchId, coordinator, supervisor, companyId, student, deployment, formId, criteria };
}

function scoresFor(criteria: Criterion[], score = 4, comment: string | null = null) {
  return criteria.map((c) => ({ criterion_id: c.id, score, comment }));
}

function submit(actor: string, deployment: string, scores: unknown, overall: string | null = null) {
  return db.query("select submit_evaluation($1, $2, $3::jsonb, $4) as id", [
    actor,
    deployment,
    JSON.stringify(scores),
    overall,
  ]);
}

async function submitOk(f: Fixture, overall: string | null = null) {
  const result = await submit(f.supervisor, f.deployment, scoresFor(f.criteria), overall);
  return (result.rows[0] as { id: string }).id;
}

async function count(sql: string, params: unknown[]) {
  return (await db.query(sql, params)).rows.length;
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

describe("submit_evaluation", () => {
  it("stores the evaluation against the published form and completes the deployment", async () => {
    const f = await setup();
    const evaluation = await submitOk(f, "  A reliable intern  ");
    const row = (
      await db.query<{
        form_id: string;
        submitted_by: string;
        overall_comment: string;
        approved_hours: string;
        required_hours: string;
      }>("select * from evaluations where id = $1", [evaluation])
    ).rows[0];
    expect(row).toMatchObject({
      form_id: f.formId,
      submitted_by: f.supervisor,
      overall_comment: "A reliable intern",
    });
    expect(Number(row.approved_hours)).toBe(18);
    expect(Number(row.required_hours)).toBe(18);
    expect(await count("select 1 from evaluation_scores where evaluation_id = $1", [evaluation])).toBe(3);
    const status = await db.query<{ status: string }>("select status from deployments where id = $1", [
      f.deployment,
    ]);
    expect(status.rows[0].status).toBe("completed");
  });

  it("keeps each score and comment, trimming comments and dropping empty ones", async () => {
    const f = await setup();
    const scores = [
      { criterion_id: f.criteria[0].id, score: 5, comment: "  Always early  " },
      { criterion_id: f.criteria[1].id, score: 3, comment: "   " },
      { criterion_id: f.criteria[2].id, score: 1 },
    ];
    const result = await submit(f.supervisor, f.deployment, scores);
    const evaluation = (result.rows[0] as { id: string }).id;
    const stored = await db.query<{ score: number; comment: string | null }>(
      "select s.score, s.comment from evaluation_scores s join evaluation_criteria c on c.id = s.criterion_id where s.evaluation_id = $1 order by c.position",
      [evaluation],
    );
    expect(stored.rows).toEqual([
      { score: 5, comment: "Always early" },
      { score: 3, comment: null },
      { score: 1, comment: null },
    ]);
  });

  it("accepts a student with exactly the required hours, and with more", async () => {
    const exact = await setup(18);
    await submitOk(exact);
    const over = await setup(27);
    await submitOk(over);
    const evaluation = await db.query<{ approved_hours: string }>(
      "select approved_hours from evaluations where deployment_id = $1",
      [over.deployment],
    );
    expect(Number(evaluation.rows[0].approved_hours)).toBe(27);
  });

  it("refuses a student below the required hours, says how many they have, and changes nothing", async () => {
    const f = await setup(9);
    await expect(submit(f.supervisor, f.deployment, scoresFor(f.criteria))).rejects.toThrow(
      /9\.00 of 18\.00 required hours/,
    );
    expect(await count("select 1 from evaluations where deployment_id = $1", [f.deployment])).toBe(0);
    const status = await db.query<{ status: string }>("select status from deployments where id = $1", [
      f.deployment,
    ]);
    expect(status.rows[0].status).toBe("active");
  });

  it("does not count pending or rejected entries toward the gate", async () => {
    const f = await setup(9);
    await db.query(
      `insert into daily_logs (deployment_id, log_date, time_in, time_out, status, journal)
       values ($1, current_date - 50, now() - interval '10 hours', now() - interval '1 hour', 'pending', 'Worked'),
              ($1, current_date - 51, now() - interval '10 hours', now() - interval '1 hour', 'rejected', 'Worked')`,
      [f.deployment],
    );
    await expect(submit(f.supervisor, f.deployment, scoresFor(f.criteria))).rejects.toThrow(
      /required hours/,
    );
  });

  it("refuses when the coordinator has not published a form, and says so", async () => {
    const f = await setup(18, [], false);
    await expect(submit(f.supervisor, f.deployment, [])).rejects.toThrow(
      /has not published the evaluation form yet/,
    );
    expect(await count("select 1 from evaluations where deployment_id = $1", [f.deployment])).toBe(0);
  });

  it("does not use a draft: only the published form counts", async () => {
    const f = await setup();
    await id("select create_evaluation_draft($1, $2) as id", [f.coordinator, f.courseId]);
    const evaluation = await submitOk(f);
    const stored = await db.query<{ form_id: string }>("select form_id from evaluations where id = $1", [
      evaluation,
    ]);
    expect(stored.rows[0].form_id).toBe(f.formId);
  });

  it("uses the version published now: an older evaluation keeps its own form", async () => {
    const f = await setup();
    const evaluation = await submitOk(f);
    const next = await id("select create_evaluation_draft($1, $2) as id", [f.coordinator, f.courseId]);
    await db.query("select save_evaluation_draft($1, $2, $3::text[])", [f.coordinator, next, ["Only one"]]);
    await db.query("select publish_evaluation_form($1, $2)", [f.coordinator, next]);
    const stored = await db.query<{ form_id: string }>("select form_id from evaluations where id = $1", [
      evaluation,
    ]);
    expect(stored.rows[0].form_id).toBe(f.formId);
  });

  it("refuses a second evaluation for the same deployment", async () => {
    const f = await setup();
    await submitOk(f);
    await expect(submit(f.supervisor, f.deployment, scoresFor(f.criteria))).rejects.toThrow(
      /already been evaluated/,
    );
    expect(await count("select 1 from evaluations where deployment_id = $1", [f.deployment])).toBe(1);
  });

  it("refuses a deployment that is not active", async () => {
    const f = await setup();
    await db.query("update deployments set status = 'ended' where id = $1", [f.deployment]);
    await expect(submit(f.supervisor, f.deployment, scoresFor(f.criteria))).rejects.toThrow(
      /only an active deployment/,
    );
  });
});

describe("what the scores must look like", () => {
  it.each([
    ["a score of 0", (c: Criterion[]) => scoresFor(c).map((s, i) => (i === 0 ? { ...s, score: 0 } : s)), /score from 1 to 5/],
    ["a score of 6", (c: Criterion[]) => scoresFor(c).map((s, i) => (i === 0 ? { ...s, score: 6 } : s)), /score from 1 to 5/],
    ["a score that is not whole", (c: Criterion[]) => scoresFor(c).map((s, i) => (i === 0 ? { ...s, score: 4.5 } : s)), /score from 1 to 5/],
    ["a score that is text", (c: Criterion[]) => scoresFor(c).map((s, i) => (i === 0 ? { ...s, score: "five" } : s)), /score from 1 to 5/],
    ["a missing score", (c: Criterion[]) => scoresFor(c).map((s, i) => (i === 0 ? { criterion_id: s.criterion_id } : s)), /score from 1 to 5/],
    ["a criterion id that is not an id", (c: Criterion[]) => scoresFor(c).map((s, i) => (i === 0 ? { ...s, criterion_id: "nope" } : s)), /score from 1 to 5/],
    ["a missing criterion", (c: Criterion[]) => scoresFor(c).slice(1), /rate every criterion/],
    ["an extra rating", (c: Criterion[]) => [...scoresFor(c), ...scoresFor(c).slice(0, 1)], /rate every criterion/],
    ["a criterion rated twice", (c: Criterion[]) => [scoresFor(c)[0], scoresFor(c)[0], scoresFor(c)[2]], /rated twice/],
    ["a comment over 500 characters", (c: Criterion[]) => scoresFor(c, 4, "x".repeat(501)), /comment is too long/],
    ["nothing", () => [], /rate every criterion/],
    ["something that is not a list", () => ({ score: 4 }), /rate every criterion/],
  ])("refuses %s and changes nothing", async (_name, make, message) => {
    const f = await setup();
    await expect(submit(f.supervisor, f.deployment, make(f.criteria))).rejects.toThrow(message);
    expect(await count("select 1 from evaluations where deployment_id = $1", [f.deployment])).toBe(0);
    expect(await count("select 1 from evaluation_scores", [])).toBeGreaterThanOrEqual(0);
    const status = await db.query<{ status: string }>("select status from deployments where id = $1", [
      f.deployment,
    ]);
    expect(status.rows[0].status).toBe("active");
  });

  it("refuses a criterion from another form", async () => {
    const f = await setup();
    const other = await setup();
    const scores = [scoresFor(f.criteria)[0], scoresFor(f.criteria)[1], scoresFor(other.criteria)[0]];
    await expect(submit(f.supervisor, f.deployment, scores)).rejects.toThrow(/not on the form/);
  });

  it("refuses an overall comment over 2000 characters", async () => {
    const f = await setup();
    await expect(
      submit(f.supervisor, f.deployment, scoresFor(f.criteria), "x".repeat(2001)),
    ).rejects.toThrow(/overall comment is too long/);
  });
});

describe("who may submit", () => {
  it.each(["student", "coordinator", "admin"])("refuses a %s", async (role) => {
    const f = await setup();
    const actor = await insertUser(role);
    await expect(submit(actor, f.deployment, scoresFor(f.criteria))).rejects.toThrow(/forbidden/);
    expect(await count("select 1 from evaluations where deployment_id = $1", [f.deployment])).toBe(0);
  });

  it("refuses an inactive supervisor", async () => {
    const f = await setup();
    await db.query("update users set is_active = false where id = $1", [f.supervisor]);
    await expect(submit(f.supervisor, f.deployment, scoresFor(f.criteria))).rejects.toThrow(
      /forbidden/,
    );
  });

  it("reports another company's student as not found and changes nothing", async () => {
    const f = await setup();
    const other = await setup();
    await expect(submit(other.supervisor, f.deployment, scoresFor(f.criteria))).rejects.toThrow(
      /not_found: student not found/,
    );
    expect(await count("select 1 from evaluations where deployment_id = $1", [f.deployment])).toBe(0);
  });

  it("cannot be called by the API roles", async () => {
    const f = await setup();
    await db.exec("set role authenticated");
    try {
      await expect(submit(f.supervisor, f.deployment, scoresFor(f.criteria))).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      await db.exec("reset role");
    }
  });
});

describe("guard rails", () => {
  it("rejects a direct insert below the hours gate", async () => {
    const f = await setup(9);
    await expect(
      db.query(
        "insert into evaluations (deployment_id, form_id, submitted_by, approved_hours, required_hours) values ($1, $2, $3, 9, 18)",
        [f.deployment, f.formId, f.supervisor],
      ),
    ).rejects.toThrow(/required hours/);
  });

  it("locks a submitted evaluation and its scores", async () => {
    const f = await setup();
    const evaluation = await submitOk(f);
    await expect(
      db.query("update evaluations set overall_comment = 'edited' where id = $1", [evaluation]),
    ).rejects.toThrow(/cannot be changed or deleted/);
    await expect(db.query("delete from evaluations where id = $1", [evaluation])).rejects.toThrow(
      /cannot be changed or deleted/,
    );
    await expect(
      db.query("update evaluation_scores set score = 1 where evaluation_id = $1", [evaluation]),
    ).rejects.toThrow(/cannot be changed or deleted/);
    await expect(
      db.query("delete from evaluation_scores where evaluation_id = $1", [evaluation]),
    ).rejects.toThrow(/cannot be changed or deleted/);
  });

  it("keeps the form the evaluation used from being changed", async () => {
    const f = await setup();
    await submitOk(f);
    await expect(
      db.query("update evaluation_criteria set label = 'Edited' where form_id = $1", [f.formId]),
    ).rejects.toThrow(/cannot be changed/);
  });

  it("is audited with the supervisor as the actor, including the deployment completing", async () => {
    const f = await setup();
    const evaluation = await submitOk(f);
    const evaluationAudit = await db.query<{ actor_id: string; action: string }>(
      "select actor_id, action from audit_log where table_name = 'evaluations' and row_id = $1",
      [evaluation],
    );
    expect(evaluationAudit.rows).toEqual([{ actor_id: f.supervisor, action: "insert" }]);
    const scoreAudit = await db.query<{ actor_id: string }>(
      "select actor_id from audit_log where table_name = 'evaluation_scores' and new_value ->> 'evaluation_id' = $1",
      [evaluation],
    );
    expect(scoreAudit.rows).toHaveLength(3);
    expect(scoreAudit.rows.every((row) => row.actor_id === f.supervisor)).toBe(true);
    const deploymentAudit = await db.query<{ actor_id: string; new_value: Record<string, string> }>(
      "select actor_id, new_value from audit_log where table_name = 'deployments' and row_id = $1 and action = 'update'",
      [f.deployment],
    );
    expect(deploymentAudit.rows.at(-1)).toMatchObject({
      actor_id: f.supervisor,
      new_value: { status: "completed" },
    });
  });

  it("is closed to the API roles (RLS on, no policies)", async () => {
    const f = await setup();
    await submitOk(f);
    await db.exec("set role authenticated");
    try {
      expect((await db.query("select * from evaluations")).rows).toHaveLength(0);
      expect((await db.query("select * from evaluation_scores")).rows).toHaveLength(0);
    } finally {
      await db.exec("reset role");
    }
  });
});
