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

function insertStudent(userId: string | null) {
  counter += 1;
  return id(
    `insert into students (user_id, course_id, ojt_batch_id, student_number, email, full_name)
     values ($1, $2, $3, $4, $5, 'Student') returning id`,
    [userId, courseId, batchId, `SN-${counter}`, `student${counter}@example.test`],
  );
}

async function studentWithAccount() {
  const user = await insertUser("student");
  const student = await insertStudent(user);
  return { user, student };
}

async function coordinatorOf(course: string) {
  const user = await insertUser("coordinator");
  await db.query(
    "insert into coordinator_assignments (user_id, course_id) values ($1, $2)",
    [user, course],
  );
  return user;
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

describe("resumes bucket", () => {
  it("is private, PDF only, and limited to 2 MB", async () => {
    const bucket = await db.query<{
      public: boolean;
      file_size_limit: string;
      allowed_mime_types: string[];
    }>(
      "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'resumes'",
    );
    expect(bucket.rows).toHaveLength(1);
    expect(bucket.rows[0].public).toBe(false);
    expect(Number(bucket.rows[0].file_size_limit)).toBe(2 * 1024 * 1024);
    expect(bucket.rows[0].allowed_mime_types).toEqual(["application/pdf"]);
  });
});

describe("save_resume", () => {
  it("records the student's own resume at a fixed path and replaces it on re-upload", async () => {
    const { user, student } = await studentWithAccount();
    const path = await db.query<{ p: string }>("select save_resume($1, 1000) as p", [user]);
    expect(path.rows[0].p).toBe(`${student}/resume.pdf`);

    await db.query("select save_resume($1, 2000)", [user]);
    const rows = await db.query<{ size_bytes: number }>(
      "select size_bytes from resumes where student_id = $1",
      [student],
    );
    expect(rows.rows).toEqual([{ size_bytes: 2000 }]);
  });

  it.each(["coordinator", "supervisor", "admin"])("refuses a %s", async (role) => {
    const user = await insertUser(role);
    await expect(db.query("select save_resume($1, 1000)", [user])).rejects.toThrow(/forbidden/);
  });

  it("refuses an inactive account and an unknown actor", async () => {
    const inactive = await insertUser("student", false);
    await insertStudent(inactive);
    await expect(db.query("select save_resume($1, 1000)", [inactive])).rejects.toThrow(/forbidden/);
    await expect(
      db.query("select save_resume('00000000-0000-4000-8000-0000000000ff', 1000)"),
    ).rejects.toThrow(/forbidden/);
  });

  it("refuses a size of zero, below zero, or over 2 MB", async () => {
    const { user } = await studentWithAccount();
    for (const size of [0, -1, 2 * 1024 * 1024 + 1]) {
      await expect(db.query("select save_resume($1, $2)", [user, size])).rejects.toThrow(/invalid/);
    }
  });

  it("refuses a student record that is not active", async () => {
    const user = await insertUser("student");
    const student = await insertStudent(user);
    await db.query("update students set is_active = false where id = $1", [student]);
    await expect(db.query("select save_resume($1, 1000)", [user])).rejects.toThrow(/forbidden/);
  });
});

describe("resume_path_for", () => {
  it("lets the student read their own resume", async () => {
    const { user, student } = await studentWithAccount();
    await db.query("select save_resume($1, 1000)", [user]);
    const path = await db.query<{ p: string }>("select resume_path_for($1, $2) as p", [
      user,
      student,
    ]);
    expect(path.rows[0].p).toBe(`${student}/resume.pdf`);
  });

  it("refuses student A reading student B's resume, before and after B uploads", async () => {
    const a = await studentWithAccount();
    const b = await studentWithAccount();
    await expect(
      db.query("select resume_path_for($1, $2)", [a.user, b.student]),
    ).rejects.toThrow(/forbidden/);
    await db.query("select save_resume($1, 1000)", [b.user]);
    await expect(
      db.query("select resume_path_for($1, $2)", [a.user, b.student]),
    ).rejects.toThrow(/forbidden/);
  });

  it("lets the coordinator of the student's course read it, and no other coordinator", async () => {
    const { user, student } = await studentWithAccount();
    await db.query("select save_resume($1, 1000)", [user]);
    const mine = await coordinatorOf(courseId);
    const other = await coordinatorOf(otherCourseId);
    const path = await db.query<{ p: string }>("select resume_path_for($1, $2) as p", [
      mine,
      student,
    ]);
    expect(path.rows[0].p).toBe(`${student}/resume.pdf`);
    await expect(
      db.query("select resume_path_for($1, $2)", [other, student]),
    ).rejects.toThrow(/forbidden/);
  });

  it("refuses an admin and, until applications exist, a supervisor", async () => {
    const { user, student } = await studentWithAccount();
    await db.query("select save_resume($1, 1000)", [user]);
    for (const role of ["admin", "supervisor"]) {
      const actor = await insertUser(role);
      await expect(
        db.query("select resume_path_for($1, $2)", [actor, student]),
      ).rejects.toThrow(/forbidden/);
    }
  });

  it("says not found only to someone allowed to ask", async () => {
    const { user, student } = await studentWithAccount();
    await expect(
      db.query("select resume_path_for($1, $2)", [user, student]),
    ).rejects.toThrow(/not_found/);
  });

  it("refuses an inactive actor and an unknown student", async () => {
    const { user, student } = await studentWithAccount();
    await db.query("select save_resume($1, 1000)", [user]);
    await db.query("update users set is_active = false where id = $1", [user]);
    await expect(
      db.query("select resume_path_for($1, $2)", [user, student]),
    ).rejects.toThrow(/forbidden/);

    const coordinator = await coordinatorOf(courseId);
    await expect(
      db.query("select resume_path_for($1, '00000000-0000-4000-8000-0000000000ff')", [
        coordinator,
      ]),
    ).rejects.toThrow(/forbidden/);
  });
});

describe("resumes table and functions are closed to the API", () => {
  it.each(["anon", "authenticated"] as const)("%s cannot read or write resumes", async (role) => {
    const { user } = await studentWithAccount();
    await db.query("select save_resume($1, 1000)", [user]);
    const seen = await asRole(db, role, () => db.query("select * from resumes"));
    expect(seen.rows).toEqual([]);
    await expect(
      asRole(db, role, () =>
        db.query(
          "insert into resumes (student_id, storage_path, size_bytes) values (gen_random_uuid(), 'x/resume.pdf', 1)",
        ),
      ),
    ).rejects.toThrow();
  });

  it.each(["anon", "authenticated"] as const)(
    "%s cannot call the resume functions",
    async (role) => {
      const { user, student } = await studentWithAccount();
      await expect(
        asRole(db, role, () => db.query("select save_resume($1, 1000)", [user])),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asRole(db, role, () =>
          db.query("select resume_path_for($1, $2)", [user, student]),
        ),
      ).rejects.toThrow(/permission denied/);
    },
  );

  it("refuses a path that is not the student's own", async () => {
    const { student } = await studentWithAccount();
    await expect(
      db.query(
        "insert into resumes (student_id, storage_path, size_bytes) values ($1, 'other/resume.pdf', 1)",
        [student],
      ),
    ).rejects.toThrow();
  });
});
