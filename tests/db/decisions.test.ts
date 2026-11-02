import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asRole, createDb, type Db } from "./harness";

let db: Db;
let courseId: string;
let batchId: string;
let counter = 0;

async function id(sql: string, params: unknown[] = []) {
  return (await db.query<{ id: string }>(sql, params)).rows[0].id;
}

function insertUser(role: string, isActive = true) {
  counter += 1;
  return id(
    "insert into users (clerk_id, email, full_name, role, is_active) values ($1, $2, $3, $4, $5) returning id",
    [`clerk-${counter}`, `user${counter}@example.test`, `User ${counter}`, role, isActive],
  );
}

async function student(withResume = true) {
  const user = await insertUser("student");
  counter += 1;
  const studentId = await id(
    `insert into students (user_id, course_id, ojt_batch_id, student_number, email, full_name)
     values ($1, $2, $3, $4, $5, 'Student') returning id`,
    [user, courseId, batchId, `SN-${counter}`, `student${counter}@example.test`],
  );
  if (withResume) await db.query("select save_resume($1, 1000)", [user]);
  return { user, studentId };
}

async function company() {
  counter += 1;
  return id("insert into companies (name) values ($1) returning id", [`Company ${counter}`]);
}

async function supervisorOf(companyId: string) {
  const user = await insertUser("supervisor");
  await db.query(
    "insert into supervisor_memberships (user_id, company_id, is_owner) values ($1, $2, false)",
    [user, companyId],
  );
  return user;
}

async function listing(companyId: string) {
  const listingId = await id(
    "insert into listings (company_id, title) values ($1, 'Intern') returning id",
    [companyId],
  );
  await db.query("insert into listing_courses (listing_id, course_id) values ($1, $2)", [
    listingId,
    courseId,
  ]);
  return listingId;
}

async function applied(studentUser: string, listingId: string) {
  return id("select apply_to_listing($1, $2) as id", [studentUser, listingId]);
}

async function statusOf(applicationId: string) {
  return (
    await db.query<{ status: string }>("select status from applications where id = $1", [
      applicationId,
    ])
  ).rows[0].status;
}

async function deploymentsOf(studentId: string) {
  return (
    await db.query<{ company_id: string; listing_id: string; ojt_batch_id: string; status: string }>(
      "select company_id, listing_id, ojt_batch_id, status from deployments where student_id = $1",
      [studentId],
    )
  ).rows;
}

beforeAll(async () => {
  db = await createDb();
  const dept = await id("insert into departments (code, name) values ('D', 'Dept') returning id");
  courseId = await id(
    "insert into courses (department_id, code, name) values ($1, 'C1', 'Course 1') returning id",
    [dept],
  );
  batchId = await id(
    "insert into ojt_batches (course_id, school_year, required_hours) values ($1, '2026-2027', 486) returning id",
    [courseId],
  );
});

afterAll(async () => {
  await db.close();
});

describe("listing management by supervisors", () => {
  it("lets a supervisor create, edit, and close a listing of their own company", async () => {
    const companyId = await company();
    const supervisor = await supervisorOf(companyId);
    const listingId = await id("select create_listing($1, $2, 'Web intern', 'Build', $3) as id", [
      supervisor,
      companyId,
      [courseId],
    ]);
    await db.query("select update_listing($1, $2, 'Web developer intern', null, $3)", [
      supervisor,
      listingId,
      [courseId],
    ]);
    await db.query("select set_listing_status($1, $2, 'closed')", [supervisor, listingId]);
    const row = await db.query<{ title: string; status: string; created_by: string }>(
      "select title, status, created_by from listings where id = $1",
      [listingId],
    );
    expect(row.rows).toEqual([
      { title: "Web developer intern", status: "closed", created_by: supervisor },
    ]);
  });

  it("refuses a supervisor of another company for create, edit, and status", async () => {
    const mine = await company();
    const theirs = await company();
    const stranger = await supervisorOf(theirs);
    const listingId = await listing(mine);
    await expect(
      db.query("select create_listing($1, $2, 'Intern', null, $3)", [stranger, mine, [courseId]]),
    ).rejects.toThrow(/forbidden/);
    await expect(
      db.query("select update_listing($1, $2, 'Hijacked', null, $3)", [stranger, listingId, [courseId]]),
    ).rejects.toThrow(/forbidden/);
    await expect(
      db.query("select set_listing_status($1, $2, 'closed')", [stranger, listingId]),
    ).rejects.toThrow(/forbidden/);
    const row = await db.query<{ title: string; status: string }>(
      "select title, status from listings where id = $1",
      [listingId],
    );
    expect(row.rows).toEqual([{ title: "Intern", status: "open" }]);
  });

  it.each(["student", "coordinator"])("refuses a %s", async (role) => {
    const companyId = await company();
    const user = await insertUser(role);
    const listingId = await listing(companyId);
    await expect(
      db.query("select create_listing($1, $2, 'Intern', null, $3)", [user, companyId, [courseId]]),
    ).rejects.toThrow(/forbidden/);
    await expect(
      db.query("select set_listing_status($1, $2, 'closed')", [user, listingId]),
    ).rejects.toThrow(/forbidden/);
  });

  it("refuses an inactive supervisor and still lets an admin manage any company", async () => {
    const companyId = await company();
    const supervisor = await supervisorOf(companyId);
    await db.query("update users set is_active = false where id = $1", [supervisor]);
    await expect(
      db.query("select create_listing($1, $2, 'Intern', null, $3)", [supervisor, companyId, [courseId]]),
    ).rejects.toThrow(/forbidden/);
    const admin = await insertUser("admin");
    const listingId = await id("select create_listing($1, $2, 'Intern', null, $3) as id", [
      admin,
      companyId,
      [courseId],
    ]);
    await db.query("select set_listing_status($1, $2, 'closed')", [admin, listingId]);
  });

  it("reports an unknown listing as not found to an admin and as forbidden to a supervisor", async () => {
    const admin = await insertUser("admin");
    const supervisor = await supervisorOf(await company());
    const unknown = "00000000-0000-4000-8000-0000000000ff";
    await expect(
      db.query("select set_listing_status($1, $2, 'closed')", [admin, unknown]),
    ).rejects.toThrow(/not_found/);
    await expect(
      db.query("select set_listing_status($1, $2, 'closed')", [supervisor, unknown]),
    ).rejects.toThrow(/forbidden/);
  });
});

describe("accept_application", () => {
  it("accepts, creates the active deployment, and withdraws the student's other open applications", async () => {
    const s = await student();
    const companyA = await company();
    const companyB = await company();
    const supervisor = await supervisorOf(companyA);
    const listingA = await listing(companyA);
    const listingB = await listing(companyB);
    const appA = await applied(s.user, listingA);
    const appB = await applied(s.user, listingB);

    const deploymentId = await id("select accept_application($1, $2) as id", [supervisor, appA]);

    expect(await statusOf(appA)).toBe("accepted");
    expect(await statusOf(appB)).toBe("withdrawn");
    expect(await deploymentsOf(s.studentId)).toEqual([
      { company_id: companyA, listing_id: listingA, ojt_batch_id: batchId, status: "active" },
    ]);
    const audit = await db.query<{ action: string; actor_id: string }>(
      "select action, actor_id from audit_log where table_name = 'deployments' and row_id = $1",
      [deploymentId],
    );
    expect(audit.rows).toEqual([{ action: "insert", actor_id: supervisor }]);
    const statusAudit = await db.query<{ actor_id: string }>(
      "select actor_id from audit_log where table_name = 'applications' and row_id = any($1) and action = 'update'",
      [[appA, appB]],
    );
    expect(statusAudit.rows).toHaveLength(2);
    expect(statusAudit.rows.every((row) => row.actor_id === supervisor)).toBe(true);
  });

  it("leaves other students' applications alone", async () => {
    const s = await student();
    const other = await student();
    const companyId = await company();
    const supervisor = await supervisorOf(companyId);
    const listingId = await listing(companyId);
    const mine = await applied(s.user, listingId);
    const theirs = await applied(other.user, listingId);
    await db.query("select accept_application($1, $2)", [supervisor, mine]);
    expect(await statusOf(theirs)).toBe("applied");
  });

  it("does not withdraw applications that were already decided", async () => {
    const s = await student();
    const companyId = await company();
    const otherCompany = await company();
    const supervisor = await supervisorOf(companyId);
    const rejectedApp = await applied(s.user, await listing(otherCompany));
    await db.query("update applications set status = 'rejected' where id = $1", [rejectedApp]);
    const app = await applied(s.user, await listing(companyId));
    await db.query("select accept_application($1, $2)", [supervisor, app]);
    expect(await statusOf(rejectedApp)).toBe("rejected");
  });

  it("changes nothing when the student already has an active deployment", async () => {
    const s = await student();
    const companyA = await company();
    const companyB = await company();
    const first = await supervisorOf(companyA);
    const second = await supervisorOf(companyB);
    const appA = await applied(s.user, await listing(companyA));
    const appB = await applied(s.user, await listing(companyB));
    // Another application is accepted first; this one is then still waiting
    // only because it was made after (we re-open it to model a stale screen).
    await db.query("select accept_application($1, $2)", [first, appA]);
    await db.query("update applications set status = 'applied' where id = $1", [appB]);

    await expect(db.query("select accept_application($1, $2)", [second, appB])).rejects.toThrow(
      /conflict: this student already has an active deployment/,
    );
    expect(await statusOf(appB)).toBe("applied");
    expect(await deploymentsOf(s.studentId)).toHaveLength(1);
  });

  it("refuses a student who is no longer active and changes nothing", async () => {
    const s = await student();
    const companyId = await company();
    const supervisor = await supervisorOf(companyId);
    const app = await applied(s.user, await listing(companyId));
    await db.query("update students set is_active = false where id = $1", [s.studentId]);
    await expect(db.query("select accept_application($1, $2)", [supervisor, app])).rejects.toThrow(
      /conflict: this student is no longer active/,
    );
    expect(await statusOf(app)).toBe("applied");
    expect(await deploymentsOf(s.studentId)).toHaveLength(0);
  });

  it("rolls back the deployment and the acceptance when the last step fails (all or nothing)", async () => {
    const s = await student();
    const companyId = await company();
    const supervisor = await supervisorOf(companyId);
    const appOther = await applied(s.user, await listing(await company()));
    const app = await applied(s.user, await listing(companyId));
    // Break the final step (withdrawing the other application) on purpose.
    await db.exec(`
      create function test_break_withdraw() returns trigger language plpgsql as $$
      begin
        if new.status = 'withdrawn' then raise exception 'boom'; end if;
        return new;
      end $$;
      create trigger test_break_withdraw before update on applications
        for each row execute function test_break_withdraw();
    `);
    try {
      await expect(db.query("select accept_application($1, $2)", [supervisor, app])).rejects.toThrow(
        /boom/,
      );
    } finally {
      await db.exec(
        "drop trigger test_break_withdraw on applications; drop function test_break_withdraw();",
      );
    }
    expect(await statusOf(app)).toBe("applied");
    expect(await statusOf(appOther)).toBe("applied");
    expect(await deploymentsOf(s.studentId)).toHaveLength(0);
  });

  it("reports another company's application as not found and changes nothing", async () => {
    const s = await student();
    const mine = await company();
    const stranger = await supervisorOf(await company());
    const app = await applied(s.user, await listing(mine));
    await expect(db.query("select accept_application($1, $2)", [stranger, app])).rejects.toThrow(
      /not_found/,
    );
    expect(await statusOf(app)).toBe("applied");
    expect(await deploymentsOf(s.studentId)).toHaveLength(0);
  });

  it.each(["admin", "student", "coordinator"])("refuses a %s", async (role) => {
    const s = await student();
    const app = await applied(s.user, await listing(await company()));
    const user = role === "student" ? (await student()).user : await insertUser(role);
    await expect(db.query("select accept_application($1, $2)", [user, app])).rejects.toThrow(
      /forbidden/,
    );
    expect(await statusOf(app)).toBe("applied");
  });

  it("refuses a supervisor with no company and an inactive supervisor", async () => {
    const s = await student();
    const companyId = await company();
    const app = await applied(s.user, await listing(companyId));
    const noCompany = await insertUser("supervisor");
    await expect(db.query("select accept_application($1, $2)", [noCompany, app])).rejects.toThrow(
      /forbidden/,
    );
    const inactive = await supervisorOf(companyId);
    await db.query("update users set is_active = false where id = $1", [inactive]);
    await expect(db.query("select accept_application($1, $2)", [inactive, app])).rejects.toThrow(
      /forbidden/,
    );
  });

  it.each(["accepted", "rejected", "withdrawn"])("refuses an application that is already %s", async (status) => {
    const s = await student();
    const companyId = await company();
    const supervisor = await supervisorOf(companyId);
    const app = await applied(s.user, await listing(companyId));
    await db.query("update applications set status = $1 where id = $2", [status, app]);
    await expect(db.query("select accept_application($1, $2)", [supervisor, app])).rejects.toThrow(
      /conflict/,
    );
    expect(await deploymentsOf(s.studentId)).toHaveLength(0);
  });

  it("reports an unknown application as not found", async () => {
    const supervisor = await supervisorOf(await company());
    await expect(
      db.query("select accept_application($1, '00000000-0000-4000-8000-0000000000ff')", [supervisor]),
    ).rejects.toThrow(/not_found/);
  });
});

describe("reject_application", () => {
  it("rejects a waiting application of the supervisor's company, and audits it", async () => {
    const s = await student();
    const companyId = await company();
    const supervisor = await supervisorOf(companyId);
    const app = await applied(s.user, await listing(companyId));
    await db.query("select reject_application($1, $2)", [supervisor, app]);
    expect(await statusOf(app)).toBe("rejected");
    const audit = await db.query<{ actor_id: string }>(
      "select actor_id from audit_log where table_name = 'applications' and row_id = $1 and action = 'update'",
      [app],
    );
    expect(audit.rows).toEqual([{ actor_id: supervisor }]);
    expect(await deploymentsOf(s.studentId)).toHaveLength(0);
  });

  it("does not touch the student's other applications", async () => {
    const s = await student();
    const companyId = await company();
    const supervisor = await supervisorOf(companyId);
    const app = await applied(s.user, await listing(companyId));
    const other = await applied(s.user, await listing(await company()));
    await db.query("select reject_application($1, $2)", [supervisor, app]);
    expect(await statusOf(other)).toBe("applied");
  });

  it("reports another company's application as not found", async () => {
    const s = await student();
    const stranger = await supervisorOf(await company());
    const app = await applied(s.user, await listing(await company()));
    await expect(db.query("select reject_application($1, $2)", [stranger, app])).rejects.toThrow(
      /not_found/,
    );
    expect(await statusOf(app)).toBe("applied");
  });

  it.each(["admin", "student", "coordinator"])("refuses a %s", async (role) => {
    const s = await student();
    const app = await applied(s.user, await listing(await company()));
    const user = role === "student" ? (await student()).user : await insertUser(role);
    await expect(db.query("select reject_application($1, $2)", [user, app])).rejects.toThrow(
      /forbidden/,
    );
    expect(await statusOf(app)).toBe("applied");
  });

  it.each(["accepted", "rejected", "withdrawn"])("refuses an application that is already %s", async (status) => {
    const s = await student();
    const companyId = await company();
    const supervisor = await supervisorOf(companyId);
    const app = await applied(s.user, await listing(companyId));
    await db.query("update applications set status = $1 where id = $2", [status, app]);
    await expect(db.query("select reject_application($1, $2)", [supervisor, app])).rejects.toThrow(
      /conflict/,
    );
  });
});

describe("the new functions are closed to the API", () => {
  it.each(["anon", "authenticated"] as const)("%s cannot call them", async (role) => {
    const supervisor = await supervisorOf(await company());
    for (const sql of [
      "select accept_application($1, gen_random_uuid())",
      "select reject_application($1, gen_random_uuid())",
      "select supervisor_company_of($1)",
      "select require_listing_manager($1, gen_random_uuid())",
    ]) {
      await expect(
        asRole(db, role, () => db.query(sql, [supervisor])),
      ).rejects.toThrow(/permission denied/);
    }
  });
});
