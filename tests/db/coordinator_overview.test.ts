import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./harness";

// The two reads behind the coordinator dashboard: deployment_activity and
// weekly_approved_hours. The school timezone is pinned to a zone where it is
// always about noon, so "this week" and "last week" are the same at any hour.

let db: Db;
let courseId: string;
let counter = 0;

async function id(sql: string, params: unknown[] = []) {
  return (await db.query<{ id: string }>(sql, params)).rows[0].id;
}

async function batch(year: string) {
  return id(
    "insert into ojt_batches (course_id, school_year, required_hours) values ($1, $2, 100) returning id",
    [courseId, year],
  );
}

async function deployment(batchId: string) {
  counter += 1;
  const user = await id(
    "insert into users (clerk_id, email, full_name, role) values ($1, $2, 'S', 'student') returning id",
    [`c-${counter}`, `s${counter}@example.test`],
  );
  const student = await id(
    `insert into students (user_id, course_id, ojt_batch_id, student_number, email, full_name)
     values ($1, $2, $3, $4, $5, 'Student') returning id`,
    [user, courseId, batchId, `SN-${counter}`, `student${counter}@example.test`],
  );
  const company = await id("insert into companies (name) values ($1) returning id", [`Co ${counter}`]);
  return id(
    "insert into deployments (student_id, company_id, ojt_batch_id) values ($1, $2, $3) returning id",
    [student, company, batchId],
  );
}

// An entry on a school date `ago` days back, `hours` long with a break.
async function entry(
  dep: string,
  ago: number,
  status: string,
  hours = 8,
  breakMinutes = 0,
  open = false,
) {
  await db.query(
    `insert into daily_logs (deployment_id, log_date, time_in, time_out, break_minutes, status, journal)
     values ($1, school_today() - $2::int, school_timestamp(school_today() - $2::int, '08:00'),
       case when $6 then null else school_timestamp(school_today() - $2::int, '08:00') + make_interval(hours => $3::int) end,
       $4, $5, 'Worked')`,
    [dep, ago, hours, breakMinutes, status, open],
  );
}

async function weekly(batchId: string, weeks: number) {
  return (
    await db.query<{ week_start: string; hours: string }>(
      "select week_start::text, hours::text from weekly_approved_hours($1, $2)",
      [batchId, weeks],
    )
  ).rows.map((row) => ({ week: row.week_start, hours: Number(row.hours) }));
}

async function thisMonday() {
  return (
    await db.query<{ d: string }>("select date_trunc('week', school_today()::timestamp)::date::text as d")
  ).rows[0].d;
}

beforeAll(async () => {
  db = await createDb();
  const offset = 12 - new Date().getUTCHours();
  const zone = offset === 0 ? "Etc/GMT" : offset > 0 ? `Etc/GMT-${offset}` : `Etc/GMT+${-offset}`;
  await db.query("update school_settings set timezone = $1", [zone]);
  const dept = await id("insert into departments (code, name) values ('CITE', 'College of IT') returning id");
  courseId = await id(
    "insert into courses (department_id, code, name) values ($1, 'BSIT', 'BSIT') returning id",
    [dept],
  );
});

afterAll(async () => {
  await db.close();
});

describe("deployment_activity", () => {
  it("counts pending and open entries and finds the latest entry day", async () => {
    const b = await batch("2026-2027");
    const dep = await deployment(b);
    await entry(dep, 5, "approved");
    await entry(dep, 4, "pending");
    await entry(dep, 3, "pending");
    await entry(dep, 2, "rejected");
    await entry(dep, 1, "open", 8, 0, true);
    const row = (
      await db.query<{ pending_entries: number; open_entries: number; last_entry_date: string }>(
        "select pending_entries, open_entries, last_entry_date::text from deployment_activity where deployment_id = $1",
        [dep],
      )
    ).rows[0];
    expect(row.pending_entries).toBe(2);
    expect(row.open_entries).toBe(1);
    const expected = await db.query<{ d: string }>("select (school_today() - 1)::text as d");
    expect(row.last_entry_date).toBe(expected.rows[0].d);
  });

  it("lists a deployment with no entries, with zeros and no date", async () => {
    const b = await batch("2027-2028");
    const dep = await deployment(b);
    const row = (
      await db.query<{ pending_entries: number; open_entries: number; last_entry_date: string | null }>(
        "select pending_entries, open_entries, last_entry_date from deployment_activity where deployment_id = $1",
        [dep],
      )
    ).rows[0];
    expect(row).toEqual({ pending_entries: 0, open_entries: 0, last_entry_date: null });
  });

  it("carries the batch and student, so the dashboard can scope it", async () => {
    const b = await batch("2028-2029");
    const dep = await deployment(b);
    const row = (
      await db.query<{ ojt_batch_id: string; student_id: string }>(
        "select ojt_batch_id, student_id from deployment_activity where deployment_id = $1",
        [dep],
      )
    ).rows[0];
    expect(row.ojt_batch_id).toBe(b);
    expect(row.student_id).toBeTruthy();
  });
});

describe("weekly_approved_hours", () => {
  it("lists the asked number of weeks, oldest first, ending with this week, empty weeks as 0", async () => {
    const b = await batch("2029-2030");
    const rows = await weekly(b, 8);
    expect(rows).toHaveLength(8);
    expect(rows.at(-1)?.week).toBe(await thisMonday());
    expect(rows.map((row) => row.week)).toEqual([...rows.map((row) => row.week)].sort());
    expect(rows.every((row) => row.hours === 0)).toBe(true);
  });

  it("sums only approved entries, takes the break off, and puts each in its own week", async () => {
    const b = await batch("2030-2031");
    const dep = await deployment(b);
    const other = await deployment(b);
    // Today, and an entry a week and a day ago (always the previous week or earlier).
    await entry(dep, 0, "approved", 8, 60);
    await entry(other, 0, "approved", 4);
    await entry(dep, 8, "approved", 6);
    const noise = await deployment(b);
    await entry(noise, 0, "pending", 5);
    await entry(noise, 1, "rejected", 5);
    const rows = await weekly(b, 4);
    const thisWeek = rows.at(-1)!;
    expect(thisWeek.hours).toBe(7 + 4);
    const total = rows.reduce((sum, row) => sum + row.hours, 0);
    expect(total).toBe(7 + 4 + 6);
  });

  it("does not count another batch, nor an entry that was never timed out", async () => {
    const mine = await batch("2031-2032");
    const theirs = await batch("2032-2033");
    const a = await deployment(mine);
    const b = await deployment(theirs);
    await entry(a, 0, "approved", 3);
    await entry(b, 0, "approved", 9);
    await entry(a, 1, "approved", 8, 0, true);
    expect((await weekly(mine, 2)).reduce((sum, row) => sum + row.hours, 0)).toBe(3);
  });

  it("limits the weeks to 1 through 52", async () => {
    const b = await batch("2033-2034");
    expect(await weekly(b, 0)).toHaveLength(1);
    expect(await weekly(b, 500)).toHaveLength(52);
  });
});

describe("closed to the API roles", () => {
  it("cannot read the view or call the function", async () => {
    const b = await batch("2034-2035");
    await db.exec("set role authenticated");
    try {
      await expect(db.query("select * from deployment_activity")).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from weekly_approved_hours($1, 4)", [b])).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      await db.exec("reset role");
    }
  });
});
