import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./harness";

let db: Db;
let courseId: string;

async function insertCourse(code: string) {
  const dept = await db.query<{ id: string }>(
    "insert into departments (code, name) values ($1, $1) returning id",
    [`D-${code}`],
  );
  const course = await db.query<{ id: string }>(
    "insert into courses (department_id, code, name) values ($1, $2, $2) returning id",
    [dept.rows[0].id, code],
  );
  return course.rows[0].id;
}

function insertBatch(course: string, schoolYear: string, hours = 300) {
  return db.query(
    "insert into ojt_batches (course_id, school_year, required_hours) values ($1, $2, $3)",
    [course, schoolYear, hours],
  );
}

beforeAll(async () => {
  db = await createDb();
  courseId = await insertCourse("COURSE-A");
});

afterAll(async () => {
  await db.close();
});

describe("school_settings", () => {
  it("is seeded with exactly one row", async () => {
    const result = await db.query<{ name: string; timezone: string }>(
      "select name, timezone from school_settings",
    );
    expect(result.rows).toEqual([
      { name: "PHINMA University of Iloilo", timezone: "Asia/Manila" },
    ]);
  });

  it("cannot hold a second row", async () => {
    await expect(
      db.query("insert into school_settings (id, name) values (false, 'Other')"),
    ).rejects.toThrow(/check constraint/);
    await expect(
      db.query("insert into school_settings (name) values ('Other')"),
    ).rejects.toThrow(/duplicate key/);
  });
});

describe("departments and courses", () => {
  it("rejects a duplicate department code", async () => {
    await db.query("insert into departments (code, name) values ('DUP', 'One')");
    await expect(
      db.query("insert into departments (code, name) values ('DUP', 'Two')"),
    ).rejects.toThrow(/duplicate key/);
  });

  it("rejects the same course code twice in one department", async () => {
    const course = await insertCourse("SHARED-1");
    const dept = await db.query<{ id: string }>(
      "select department_id as id from courses where id = $1",
      [course],
    );
    await expect(
      db.query(
        "insert into courses (department_id, code, name) values ($1, 'SHARED-1', 'Again')",
        [dept.rows[0].id],
      ),
    ).rejects.toThrow(/duplicate key/);
  });
});

describe("ojt_batches", () => {
  it("rejects a second batch for the same course and school year", async () => {
    await insertBatch(courseId, "2026-2027");
    await expect(insertBatch(courseId, "2026-2027")).rejects.toThrow(
      /duplicate key/,
    );
  });

  it("allows the same school year for another course", async () => {
    const other = await insertCourse("COURSE-B");
    await expect(insertBatch(other, "2026-2027")).resolves.toBeTruthy();
  });

  it.each(["2026", "2026-2028", "26-27", "2026/2027", "abcd-efgh"])(
    "rejects the school year %s",
    async (year) => {
      await expect(insertBatch(courseId, year)).rejects.toThrow();
    },
  );

  it("rejects required hours that are not positive", async () => {
    await expect(insertBatch(courseId, "2027-2028", 0)).rejects.toThrow(
      /check constraint/,
    );
  });

  it("defaults the stale threshold to 3 days and the time-in window to 30 minutes", async () => {
    await insertBatch(courseId, "2028-2029");
    const row = await db.query<{
      stale_threshold_days: number;
      time_in_window_minutes: number;
    }>(
      "select stale_threshold_days, time_in_window_minutes from ojt_batches where school_year = '2028-2029' and course_id = $1",
      [courseId],
    );
    expect(row.rows[0]).toEqual({
      stale_threshold_days: 3,
      time_in_window_minutes: 30,
    });
  });

  it("moves planned to active to closed and nothing else", async () => {
    await insertBatch(courseId, "2029-2030");
    const found = await db.query<{ id: string }>(
      "select id from ojt_batches where school_year = '2029-2030' and course_id = $1",
      [courseId],
    );
    const id = found.rows[0].id;
    const setStatus = (status: string) =>
      db.query("update ojt_batches set status = $2 where id = $1", [id, status]);

    await expect(setStatus("closed")).rejects.toThrow(/cannot change/);
    await setStatus("active");
    await expect(setStatus("planned")).rejects.toThrow(/cannot change/);
    await setStatus("closed");
    await expect(setStatus("active")).rejects.toThrow(/cannot change/);
  });
});
