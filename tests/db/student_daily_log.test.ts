import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./harness";

// The student's side of the daily log. The functions read the database clock,
// which a test cannot change, so beforeAll moves the school timezone to a zone
// where it is always about noon. Schedules and windows are then fixed clock
// times (08:00 to 17:00) and the tests give the same answer at any hour.

let db: Db;
let courseId: string;
let batchId: string;
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

async function company() {
  counter += 1;
  return id("insert into companies (name) values ($1) returning id", [`Company ${counter}`]);
}

async function student(companyId: string, status = "active") {
  const user = await insertUser("student");
  counter += 1;
  const studentId = await id(
    `insert into students (user_id, course_id, ojt_batch_id, student_number, email, full_name)
     values ($1, $2, $3, $4, $5, 'Student') returning id`,
    [user, courseId, batchId, `SN-${counter}`, `student${counter}@example.test`],
  );
  const deployment = await id(
    "insert into deployments (student_id, company_id, ojt_batch_id, status) values ($1, $2, $3, $4) returning id",
    [studentId, companyId, batchId, status],
  );
  return { user, studentId, deployment };
}

// Minutes since midnight in school time, right now (about noon, see above).
async function nowMinutes() {
  const row = await db.query<{ m: number }>(
    "select (extract(hour from (now() at time zone (select timezone from school_settings))) * 60 + extract(minute from (now() at time zone (select timezone from school_settings))))::int as m",
  );
  return row.rows[0].m;
}

function clock(minutes: number) {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

async function scheduleToday(deployment: string, start: string, end: string) {
  const supervisor = await insertUser("supervisor");
  const schedule = await id(
    "insert into work_schedules (deployment_id, effective_from, created_by) values ($1, school_today(), $2) returning id",
    [deployment, supervisor],
  );
  await db.query(
    "insert into work_schedule_days (schedule_id, weekday, start_time, end_time) values ($1, extract(isodow from school_today())::int, $2, $3)",
    [schedule, start, end],
  );
  return schedule;
}

function timeIn(user: string) {
  return id("select time_in($1) as id", [user]);
}

function timeOut(user: string, log: string, journal: string | null, reason: string | null = null) {
  return db.query("select time_out($1, $2, $3, $4)", [user, log, journal, reason]);
}

async function logRow(log: string) {
  return (
    await db.query<{
      status: string;
      log_date: string;
      time_out: string | null;
      journal: string | null;
      early_out_reason: string | null;
      reject_reason: string | null;
      schedule_start: string | null;
      schedule_end: string | null;
    }>(
      "select status, log_date::text, time_out::text, journal, early_out_reason, reject_reason, schedule_start::text, schedule_end::text from daily_logs where id = $1",
      [log],
    )
  ).rows[0];
}

// A student with an active deployment and a schedule of 08:00 to 17:00 today.
async function ready() {
  const created = await student(await company());
  await scheduleToday(created.deployment, "08:00", "17:00");
  return created;
}

beforeAll(async () => {
  db = await createDb();
  // A fixed-offset zone where it is now between 12:00 and 12:59.
  const offset = 12 - new Date().getUTCHours();
  const zone = offset === 0 ? "Etc/GMT" : offset > 0 ? `Etc/GMT-${offset}` : `Etc/GMT+${-offset}`;
  await db.query("update school_settings set timezone = $1", [zone]);
  const dept = await id(
    "insert into departments (code, name) values ('CITE', 'College of IT') returning id",
  );
  courseId = await id(
    "insert into courses (department_id, code, name) values ($1, 'BSIT', 'BSIT') returning id",
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

describe("time_in", () => {
  it("starts an open entry on the school date with the schedule snapshot", async () => {
    const s = await ready();
    const log = await timeIn(s.user);
    const row = await logRow(log);
    const today = (await db.query<{ d: string }>("select school_today()::text as d")).rows[0].d;
    expect(row).toMatchObject({ status: "open", log_date: today, time_out: null });
    expect(row.schedule_start).not.toBeNull();
    expect(row.schedule_end).not.toBeNull();
  });

  it("uses the database clock for the time in", async () => {
    const s = await ready();
    const log = await timeIn(s.user);
    const diff = await db.query<{ seconds: number }>(
      "select abs(extract(epoch from (now() - time_in)))::int as seconds from daily_logs where id = $1",
      [log],
    );
    expect(diff.rows[0].seconds).toBeLessThan(5);
  });

  it("refuses a second time in on the same day", async () => {
    const s = await ready();
    await timeIn(s.user);
    await expect(timeIn(s.user)).rejects.toThrow(/conflict: you already timed in today/);
    expect(
      (await db.query("select 1 from daily_logs where deployment_id = $1", [s.deployment])).rows,
    ).toHaveLength(1);
  });

  it("refuses when no schedule has been set", async () => {
    const s = await student(await company());
    await expect(timeIn(s.user)).rejects.toThrow(/has not set your work schedule/);
  });

  it("refuses on a day that is not a working day", async () => {
    const s = await student(await company());
    const supervisor = await insertUser("supervisor");
    const schedule = await id(
      "insert into work_schedules (deployment_id, effective_from, created_by) values ($1, school_today(), $2) returning id",
      [s.deployment, supervisor],
    );
    await db.query(
      "insert into work_schedule_days (schedule_id, weekday, start_time, end_time) values ($1, (extract(isodow from school_today())::int % 7) + 1, '08:00', '17:00')",
      [schedule],
    );
    await expect(timeIn(s.user)).rejects.toThrow(/not one of your working days/);
  });

  it("ignores a schedule that has not started yet", async () => {
    const s = await student(await company());
    const supervisor = await insertUser("supervisor");
    const schedule = await id(
      "insert into work_schedules (deployment_id, effective_from, created_by) values ($1, school_today() + 1, $2) returning id",
      [s.deployment, supervisor],
    );
    await db.query(
      "insert into work_schedule_days (schedule_id, weekday, start_time, end_time) select $1, g, '00:00', '23:59' from generate_series(1, 7) g",
      [schedule],
    );
    await expect(timeIn(s.user)).rejects.toThrow(/has not set your work schedule/);
  });

  it("refuses before the window opens and says when it opens", async () => {
    const s = await student(await company());
    await scheduleToday(s.deployment, "15:00", "18:00");
    await expect(timeIn(s.user)).rejects.toThrow(/you can time in from 02:30 PM/);
  });

  it("opens the window 30 minutes before the start", async () => {
    const now = await nowMinutes();
    const s = await student(await company());
    await scheduleToday(s.deployment, clock(now + 20), clock(now + 120));
    expect(await timeIn(s.user)).toBeTruthy();
    const late = await student(await company());
    await scheduleToday(late.deployment, clock(now + 40), clock(now + 120));
    await expect(timeIn(late.user)).rejects.toThrow(/you can time in from/);
  });

  it("refuses after the scheduled end", async () => {
    const s = await student(await company());
    await scheduleToday(s.deployment, "08:00", "10:00");
    await expect(timeIn(s.user)).rejects.toThrow(/scheduled time today has already ended/);
  });

  it("refuses a student with no active deployment", async () => {
    const s = await student(await company(), "ended");
    await expect(timeIn(s.user)).rejects.toThrow(/do not have an active deployment/);
  });

  it.each(["supervisor", "coordinator", "admin"])("refuses a %s", async (role) => {
    await expect(timeIn(await insertUser(role))).rejects.toThrow(/forbidden/);
  });

  it("refuses an inactive student", async () => {
    const s = await ready();
    await db.query("update users set is_active = false where id = $1", [s.user]);
    await expect(timeIn(s.user)).rejects.toThrow(/forbidden/);
  });

  it("audits the new entry with the student as the actor", async () => {
    const s = await ready();
    const log = await timeIn(s.user);
    const audit = await db.query<{ actor_id: string; action: string }>(
      "select actor_id, action from audit_log where table_name = 'daily_logs' and row_id = $1",
      [log],
    );
    expect(audit.rows).toEqual([{ actor_id: s.user, action: "insert" }]);
  });
});

describe("time_out", () => {
  it("needs a reason before the scheduled end, and stores it", async () => {
    const s = await ready();
    const log = await timeIn(s.user);
    await expect(timeOut(s.user, log, "Did some work")).rejects.toThrow(
      /give a reason for timing out before/,
    );
    expect((await logRow(log)).status).toBe("open");

    await timeOut(s.user, log, "  Did some work  ", "Doctor appointment");
    expect(await logRow(log)).toMatchObject({
      status: "pending",
      journal: "Did some work",
      early_out_reason: "Doctor appointment",
    });
    expect((await logRow(log)).time_out).not.toBeNull();
  });

  it("needs no reason once the scheduled end has passed, and drops any reason sent", async () => {
    const s = await ready();
    const log = await timeIn(s.user);
    await db.query("update daily_logs set schedule_end = '00:00:01', schedule_start = '00:00' where id = $1", [log]);
    await timeOut(s.user, log, "Full day", "not needed");
    expect(await logRow(log)).toMatchObject({ status: "pending", early_out_reason: null });
  });

  it.each([null, "", "   "])("refuses an empty journal (%j)", async (journal) => {
    const s = await ready();
    const log = await timeIn(s.user);
    await expect(timeOut(s.user, log, journal, "reason")).rejects.toThrow(/write a short journal/);
    expect((await logRow(log)).status).toBe("open");
  });

  it("refuses a journal over 4000 characters and a reason over 500", async () => {
    const s = await ready();
    const log = await timeIn(s.user);
    await expect(timeOut(s.user, log, "x".repeat(4001), "reason")).rejects.toThrow(/too long/);
    await expect(timeOut(s.user, log, "ok", "x".repeat(501))).rejects.toThrow(/too long/);
  });

  it("refuses an entry that is not open", async () => {
    const s = await ready();
    const log = await timeIn(s.user);
    await timeOut(s.user, log, "Done", "reason");
    await expect(timeOut(s.user, log, "Again", "reason")).rejects.toThrow(/not open/);
  });

  it("refuses another student's entry as not found, and changes nothing", async () => {
    const owner = await ready();
    const log = await timeIn(owner.user);
    const other = await student(await company());
    await expect(timeOut(other.user, log, "Sneaky", "reason")).rejects.toThrow(/not_found/);
    expect((await logRow(log)).status).toBe("open");
  });

  it.each(["supervisor", "coordinator", "admin"])("refuses a %s", async (role) => {
    const s = await ready();
    const log = await timeIn(s.user);
    await expect(timeOut(await insertUser(role), log, "x", "x")).rejects.toThrow(/forbidden/);
  });

  it("refuses once the deployment is no longer active", async () => {
    const s = await ready();
    const log = await timeIn(s.user);
    await db.query("update deployments set status = 'ended' where id = $1", [s.deployment]);
    await expect(timeOut(s.user, log, "Late", "reason")).rejects.toThrow(/no longer active/);
  });

  it("does not count toward approved hours until approved", async () => {
    const s = await ready();
    const log = await timeIn(s.user);
    await timeOut(s.user, log, "Done", "reason");
    const hours = await db.query<{ approved_hours: string }>(
      "select approved_hours from deployment_hours where deployment_id = $1",
      [s.deployment],
    );
    expect(Number(hours.rows[0].approved_hours)).toBe(0);
  });
});

describe("save_journal", () => {
  it("saves a draft while open and clears it when empty", async () => {
    const s = await ready();
    const log = await timeIn(s.user);
    await db.query("select save_journal($1, $2, $3)", [s.user, log, "  Morning notes "]);
    expect((await logRow(log)).journal).toBe("Morning notes");
    await db.query("select save_journal($1, $2, $3)", [s.user, log, ""]);
    expect((await logRow(log)).journal).toBeNull();
  });

  it("refuses a pending entry, someone else's entry, and a journal over 4000", async () => {
    const s = await ready();
    const log = await timeIn(s.user);
    await expect(
      db.query("select save_journal($1, $2, $3)", [s.user, log, "x".repeat(4001)]),
    ).rejects.toThrow(/too long/);
    const other = await student(await company());
    await expect(
      db.query("select save_journal($1, $2, $3)", [other.user, log, "hi"]),
    ).rejects.toThrow(/not_found/);
    await timeOut(s.user, log, "Done", "reason");
    await expect(
      db.query("select save_journal($1, $2, $3)", [s.user, log, "edit"]),
    ).rejects.toThrow(/can no longer be edited/);
  });
});

describe("resubmit_log", () => {
  async function rejected() {
    const s = await ready();
    const log = await timeIn(s.user);
    await timeOut(s.user, log, "First try", "reason");
    // The supervisor rejects (ticket-21 adds the function; the row change is the same).
    await db.query(
      "update daily_logs set status = 'rejected', reject_reason = 'Too short' where id = $1",
      [log],
    );
    return { ...s, log };
  }

  it("moves a rejected entry back to pending with the fixed journal", async () => {
    const r = await rejected();
    await db.query("select resubmit_log($1, $2, $3)", [r.user, r.log, " Longer journal "]);
    expect(await logRow(r.log)).toMatchObject({
      status: "pending",
      journal: "Longer journal",
      reject_reason: null,
    });
  });

  it("keeps the earlier journal and reason in the audit log", async () => {
    const r = await rejected();
    await db.query("select resubmit_log($1, $2, $3)", [r.user, r.log, "Better"]);
    const audit = await db.query<{ old_value: Record<string, string> }>(
      "select old_value from audit_log where table_name = 'daily_logs' and row_id = $1 and action = 'update' order by id desc limit 1",
      [r.log],
    );
    expect(audit.rows[0].old_value).toMatchObject({ journal: "First try", reject_reason: "Too short" });
  });

  it("refuses an empty journal, a pending entry, and someone else's entry", async () => {
    const r = await rejected();
    await expect(
      db.query("select resubmit_log($1, $2, $3)", [r.user, r.log, "  "]),
    ).rejects.toThrow(/write a short journal/);
    const other = await student(await company());
    await expect(
      db.query("select resubmit_log($1, $2, $3)", [other.user, r.log, "hi"]),
    ).rejects.toThrow(/not_found/);
    await db.query("select resubmit_log($1, $2, $3)", [r.user, r.log, "Fixed"]);
    await expect(
      db.query("select resubmit_log($1, $2, $3)", [r.user, r.log, "Again"]),
    ).rejects.toThrow(/only a rejected entry/);
  });
});

describe("approved entries stay locked", () => {
  it("keeps the student out of an approved entry", async () => {
    const s = await ready();
    const log = await timeIn(s.user);
    await timeOut(s.user, log, "Done", "reason");
    await db.query("update daily_logs set status = 'approved' where id = $1", [log]);
    await expect(
      db.query("select save_journal($1, $2, $3)", [s.user, log, "edit"]),
    ).rejects.toThrow(/can no longer be edited/);
    await expect(
      db.query("select resubmit_log($1, $2, $3)", [s.user, log, "edit"]),
    ).rejects.toThrow(/only a rejected entry/);
  });
});

describe("API roles", () => {
  it("cannot call the student functions", async () => {
    const s = await ready();
    await db.exec("set role authenticated");
    try {
      await expect(timeIn(s.user)).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });
});
