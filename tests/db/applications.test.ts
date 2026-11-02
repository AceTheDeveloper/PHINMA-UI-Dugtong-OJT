import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asRole, createDb, type Db } from "./harness";

let db: Db;
let courseId: string;
let otherCourseId: string;
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

function insertStudent(userId: string | null, course = courseId) {
  counter += 1;
  return id(
    `insert into students (user_id, course_id, ojt_batch_id, student_number, email, full_name)
     values ($1, $2, $3, $4, $5, 'Student') returning id`,
    [userId, course, batchId, `SN-${counter}`, `student${counter}@example.test`],
  );
}

async function student(withResume = true, course = courseId) {
  const user = await insertUser("student");
  const studentId = await insertStudent(user, course);
  if (withResume) await db.query("select save_resume($1, 1000)", [user]);
  return { user, studentId };
}

async function company(status = "active") {
  counter += 1;
  return id("insert into companies (name, status) values ($1, $2) returning id", [
    `Company ${counter}`,
    status,
  ]);
}

async function listing(
  companyId: string,
  options: { status?: string; courses?: string[] } = {},
) {
  const listingId = await id(
    "insert into listings (company_id, title, status) values ($1, 'Intern', $2) returning id",
    [companyId, options.status ?? "open"],
  );
  for (const course of options.courses ?? [courseId]) {
    await db.query("insert into listing_courses (listing_id, course_id) values ($1, $2)", [
      listingId,
      course,
    ]);
  }
  return listingId;
}

async function supervisorOf(companyId: string) {
  const user = await insertUser("supervisor");
  await db.query(
    "insert into supervisor_memberships (user_id, company_id, is_owner) values ($1, $2, false)",
    [user, companyId],
  );
  return user;
}

async function apply(user: string, listingId: string) {
  return id("select apply_to_listing($1, $2) as id", [user, listingId]);
}

beforeAll(async () => {
  db = await createDb();
  const dept = await id(
    "insert into departments (code, name) values ('D', 'Dept') returning id",
  );
  courseId = await id(
    "insert into courses (department_id, code, name) values ($1, 'C1', 'Course 1') returning id",
    [dept],
  );
  otherCourseId = await id(
    "insert into courses (department_id, code, name) values ($1, 'C2', 'Course 2') returning id",
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

describe("apply_to_listing", () => {
  it("lets a student with a resume apply to an open listing of their course", async () => {
    const s = await student();
    const l = await listing(await company());
    const appId = await apply(s.user, l);
    const row = await db.query<{ status: string; student_id: string; listing_id: string }>(
      "select status, student_id, listing_id from applications where id = $1",
      [appId],
    );
    expect(row.rows).toEqual([{ status: "applied", student_id: s.studentId, listing_id: l }]);
  });

  it("allows several different listings for one student", async () => {
    const s = await student();
    const a = await apply(s.user, await listing(await company()));
    const b = await apply(s.user, await listing(await company()));
    expect(a).not.toBe(b);
  });

  it("refuses a second application to the same listing", async () => {
    const s = await student();
    const l = await listing(await company());
    await apply(s.user, l);
    await expect(apply(s.user, l)).rejects.toThrow(/conflict: you already applied/);
  });

  it("refuses a student who has not uploaded a resume", async () => {
    const s = await student(false);
    const l = await listing(await company());
    await expect(apply(s.user, l)).rejects.toThrow(/invalid: upload your resume/);
    const count = await db.query("select 1 from applications where student_id = $1", [s.studentId]);
    expect(count.rows).toHaveLength(0);
  });

  it("reports a closed listing, an inactive company, a listing for another course, and an unknown listing as not found", async () => {
    const s = await student();
    const closed = await listing(await company(), { status: "closed" });
    const inactive = await listing(await company("inactive"));
    const otherCourse = await listing(await company(), { courses: [otherCourseId] });
    for (const target of [
      closed,
      inactive,
      otherCourse,
      "00000000-0000-4000-8000-0000000000ff",
    ]) {
      await expect(apply(s.user, target)).rejects.toThrow(/not_found/);
    }
  });

  it.each(["coordinator", "supervisor", "admin"])("refuses a %s", async (role) => {
    const user = await insertUser(role);
    const l = await listing(await company());
    await expect(apply(user, l)).rejects.toThrow(/forbidden/);
  });

  it("refuses an inactive account, an inactive student record, and an unknown actor", async () => {
    const l = await listing(await company());
    const inactiveUser = await insertUser("student", false);
    await insertStudent(inactiveUser);
    await expect(apply(inactiveUser, l)).rejects.toThrow(/forbidden/);

    const s = await student();
    await db.query("update students set is_active = false where id = $1", [s.studentId]);
    await expect(apply(s.user, l)).rejects.toThrow(/forbidden/);

    await expect(apply("00000000-0000-4000-8000-0000000000ff", l)).rejects.toThrow(/forbidden/);
  });

  it("audits the application with the student as the actor", async () => {
    const s = await student();
    const appId = await apply(s.user, await listing(await company()));
    const audit = await db.query<{ action: string; actor_id: string; source: string }>(
      "select action, actor_id, source from audit_log where table_name = 'applications' and row_id = $1",
      [appId],
    );
    expect(audit.rows).toEqual([{ action: "insert", actor_id: s.user, source: "app" }]);
  });
});

describe("withdraw_application", () => {
  it("lets the student withdraw their own applied application, and audits it", async () => {
    const s = await student();
    const appId = await apply(s.user, await listing(await company()));
    await db.query("select withdraw_application($1, $2)", [s.user, appId]);
    const row = await db.query<{ status: string }>("select status from applications where id = $1", [appId]);
    expect(row.rows[0].status).toBe("withdrawn");
    const audit = await db.query<{ new_value: { status: string } }>(
      "select new_value from audit_log where table_name = 'applications' and row_id = $1 and action = 'update'",
      [appId],
    );
    expect(audit.rows[0].new_value.status).toBe("withdrawn");
  });

  it("reports someone else's application as not found and leaves it applied", async () => {
    const owner = await student();
    const other = await student();
    const appId = await apply(owner.user, await listing(await company()));
    await expect(
      db.query("select withdraw_application($1, $2)", [other.user, appId]),
    ).rejects.toThrow(/not_found/);
    const row = await db.query<{ status: string }>("select status from applications where id = $1", [appId]);
    expect(row.rows[0].status).toBe("applied");
  });

  it.each(["accepted", "rejected", "withdrawn"])("refuses an application that is already %s", async (status) => {
    const s = await student();
    const appId = await apply(s.user, await listing(await company()));
    await db.query("update applications set status = $1 where id = $2", [status, appId]);
    await expect(
      db.query("select withdraw_application($1, $2)", [s.user, appId]),
    ).rejects.toThrow(/conflict/);
  });

  it.each(["coordinator", "supervisor", "admin"])("refuses a %s", async (role) => {
    const s = await student();
    const appId = await apply(s.user, await listing(await company()));
    const user = await insertUser(role);
    await expect(
      db.query("select withdraw_application($1, $2)", [user, appId]),
    ).rejects.toThrow(/forbidden/);
  });

  it("reports an unknown application as not found", async () => {
    const s = await student();
    await expect(
      db.query("select withdraw_application($1, '00000000-0000-4000-8000-0000000000ff')", [s.user]),
    ).rejects.toThrow(/not_found/);
  });
});

describe("resume access for supervisors", () => {
  it("lets a supervisor of the company applied to read the resume", async () => {
    const s = await student();
    const companyId = await company();
    const supervisor = await supervisorOf(companyId);
    await apply(s.user, await listing(companyId));
    const path = await db.query<{ p: string }>("select resume_path_for($1, $2) as p", [
      supervisor,
      s.studentId,
    ]);
    expect(path.rows[0].p).toBe(`${s.studentId}/resume.pdf`);
  });

  it("refuses a supervisor before any application and a supervisor of another company", async () => {
    const s = await student();
    const companyId = await company();
    const supervisor = await supervisorOf(companyId);
    const stranger = await supervisorOf(await company());
    await expect(
      db.query("select resume_path_for($1, $2)", [supervisor, s.studentId]),
    ).rejects.toThrow(/forbidden/);
    await apply(s.user, await listing(companyId));
    await expect(
      db.query("select resume_path_for($1, $2)", [stranger, s.studentId]),
    ).rejects.toThrow(/forbidden/);
  });

  it("refuses the supervisor once the application is withdrawn, and keeps it for accepted and rejected", async () => {
    const s = await student();
    const companyId = await company();
    const supervisor = await supervisorOf(companyId);
    const appId = await apply(s.user, await listing(companyId));
    for (const status of ["accepted", "rejected"]) {
      await db.query("update applications set status = $1 where id = $2", [status, appId]);
      const ok = await db.query("select resume_path_for($1, $2)", [supervisor, s.studentId]);
      expect(ok.rows).toHaveLength(1);
    }
    await db.query("update applications set status = 'withdrawn' where id = $1", [appId]);
    await expect(
      db.query("select resume_path_for($1, $2)", [supervisor, s.studentId]),
    ).rejects.toThrow(/forbidden/);
  });

  it("still refuses admins and coordinators of another course", async () => {
    const s = await student();
    const companyId = await company();
    await apply(s.user, await listing(companyId));
    const admin = await insertUser("admin");
    const coordinator = await insertUser("coordinator");
    await db.query("insert into coordinator_assignments (user_id, course_id) values ($1, $2)", [
      coordinator,
      otherCourseId,
    ]);
    for (const actor of [admin, coordinator]) {
      await expect(
        db.query("select resume_path_for($1, $2)", [actor, s.studentId]),
      ).rejects.toThrow(/forbidden/);
    }
  });
});

describe("applications are closed to the API", () => {
  it.each(["anon", "authenticated"] as const)("%s reads nothing and cannot write", async (role) => {
    const s = await student();
    await apply(s.user, await listing(await company()));
    const seen = await asRole(db, role, () => db.query("select * from applications"));
    expect(seen.rows).toEqual([]);
    await expect(
      asRole(db, role, () =>
        db.query("update applications set status = 'accepted'"),
      ),
    ).resolves.toMatchObject({ affectedRows: 0 });
  });

  it.each(["anon", "authenticated"] as const)("%s cannot call the application functions", async (role) => {
    const s = await student();
    const l = await listing(await company());
    await expect(
      asRole(db, role, () => db.query("select apply_to_listing($1, $2)", [s.user, l])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asRole(db, role, () =>
        db.query("select withdraw_application($1, gen_random_uuid())", [s.user]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asRole(db, role, () => db.query("select active_student_of($1)", [s.user])),
    ).rejects.toThrow(/permission denied/);
  });
});
