import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./harness";

let db: Db;
let courseId: string;
let otherCourseId: string;
let batchId: string;
let otherBatchId: string;
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

function insertStudent(
  overrides: {
    userId?: string | null;
    number?: string;
    email?: string;
    batch?: string;
    course?: string;
  } = {},
) {
  counter += 1;
  return db.query(
    `insert into students (user_id, course_id, ojt_batch_id, student_number, email, full_name)
     values ($1, $2, $3, $4, $5, 'Student')`,
    [
      overrides.userId ?? null,
      overrides.course ?? courseId,
      overrides.batch ?? batchId,
      overrides.number ?? `N-${counter}`,
      overrides.email ?? `student${counter}@example.test`,
    ],
  );
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
    "insert into ojt_batches (course_id, school_year, required_hours) values ($1, '2026-2027', 300) returning id",
    [courseId],
  );
  otherBatchId = await id(
    "insert into ojt_batches (course_id, school_year, required_hours) values ($1, '2027-2028', 300) returning id",
    [courseId],
  );
});

afterAll(async () => {
  await db.close();
});

describe("users", () => {
  it("rejects a duplicate clerk id", async () => {
    await db.query(
      "insert into users (clerk_id, email, full_name, role) values ('dup', 'a@example.test', 'A', 'admin')",
    );
    await expect(
      db.query(
        "insert into users (clerk_id, email, full_name, role) values ('dup', 'b@example.test', 'B', 'admin')",
      ),
    ).rejects.toThrow(/duplicate key/);
  });

  it("treats emails as case-insensitive", async () => {
    await db.query(
      "insert into users (clerk_id, email, full_name, role) values ('c1', 'Same@Example.test', 'A', 'admin')",
    );
    await expect(
      db.query(
        "insert into users (clerk_id, email, full_name, role) values ('c2', 'same@example.test', 'B', 'admin')",
      ),
    ).rejects.toThrow(/duplicate key/);
  });

  it("does not allow a role change", async () => {
    const user = await insertUser("student");
    await expect(
      db.query("update users set role = 'admin' where id = $1", [user]),
    ).rejects.toThrow(/role cannot be changed/);
  });
});

describe("coordinator_assignments", () => {
  it("accepts a coordinator and rejects any other role", async () => {
    const coordinator = await insertUser("coordinator");
    await db.query(
      "insert into coordinator_assignments (user_id, course_id) values ($1, $2)",
      [coordinator, courseId],
    );
    const student = await insertUser("student");
    await expect(
      db.query(
        "insert into coordinator_assignments (user_id, course_id) values ($1, $2)",
        [student, courseId],
      ),
    ).rejects.toThrow(/must have role coordinator/);
  });

  it("allows one coordinator on several courses", async () => {
    const coordinator = await insertUser("coordinator");
    for (const course of [courseId, otherCourseId]) {
      await db.query(
        "insert into coordinator_assignments (user_id, course_id) values ($1, $2)",
        [coordinator, course],
      );
    }
  });
});

describe("students", () => {
  it("rejects a duplicate student number in the same batch", async () => {
    await insertStudent({ number: "2026-0001" });
    await expect(insertStudent({ number: "2026-0001" })).rejects.toThrow(
      /duplicate key/,
    );
  });

  it("allows the same student number in another batch", async () => {
    await insertStudent({ number: "2026-0002" });
    await expect(
      insertStudent({ number: "2026-0002", batch: otherBatchId }),
    ).resolves.toBeTruthy();
  });

  it("rejects a duplicate email regardless of case", async () => {
    await insertStudent({ email: "Dup.Student@example.test" });
    await expect(
      insertStudent({ email: "dup.student@example.test" }),
    ).rejects.toThrow(/duplicate key/);
  });

  it("rejects a course that does not match the course of the batch", async () => {
    await expect(insertStudent({ course: otherCourseId })).rejects.toThrow(
      /foreign key/,
    );
  });

  it("links to a user only if the user is a student", async () => {
    const student = await insertUser("student");
    await expect(insertStudent({ userId: student })).resolves.toBeTruthy();
    const supervisor = await insertUser("supervisor");
    await expect(insertStudent({ userId: supervisor })).rejects.toThrow(
      /must have role student/,
    );
  });

  it("allows a roster record with no user yet", async () => {
    await expect(insertStudent({ userId: null })).resolves.toBeTruthy();
  });
});

describe("consents", () => {
  it("records one consent per user and notice version", async () => {
    const user = await insertUser("student");
    await db.query(
      "insert into consents (user_id, notice_version) values ($1, 'v1')",
      [user],
    );
    await expect(
      db.query(
        "insert into consents (user_id, notice_version) values ($1, 'v1')",
        [user],
      ),
    ).rejects.toThrow(/duplicate key/);
    await db.query(
      "insert into consents (user_id, notice_version) values ($1, 'v2')",
      [user],
    );
  });
});
