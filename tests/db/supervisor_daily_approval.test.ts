import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./harness";

// The supervisor's side of the daily log. The functions read the database
// clock, which a test cannot change, so beforeAll moves the school timezone to a
// zone where it is always about noon. That keeps "today" and "yesterday" stable
// at any hour the suite runs.

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

async function supervisorOf(companyId: string) {
  const user = await insertUser("supervisor");
  await db.query(
    "insert into supervisor_memberships (user_id, company_id, is_owner) values ($1, $2, false)",
    [user, companyId],
  );
  return user;
}

// A student deployed at the company ten days ago, so earlier days can be added.
async function student(companyId: string, status = "active") {
  const user = await insertUser("student");
  counter += 1;
  const studentId = await id(
    `insert into students (user_id, course_id, ojt_batch_id, student_number, email, full_name)
     values ($1, $2, $3, $4, $5, 'Student') returning id`,
    [user, courseId, batchId, `SN-${counter}`, `student${counter}@example.test`],
  );
  const deployment = await id(
    "insert into deployments (student_id, company_id, ojt_batch_id, status, created_at) values ($1, $2, $3, $4, now() - interval '10 days') returning id",
    [studentId, companyId, batchId, status],
  );
  return { user, deployment };
}

async function daysAgo(n: number) {
  return (await db.query<{ d: string }>("select (school_today() - $1::int)::text as d", [n])).rows[0]
    .d;
}

// An entry as the student leaves it: 08:00 to 17:00 on a school date.
async function entry(
  deployment: string,
  over: { status?: string; journal?: string | null; ago?: number; open?: boolean } = {},
) {
  const date = await daysAgo(over.ago ?? 1);
  return id(
    `insert into daily_logs (deployment_id, log_date, time_in, time_out, status, journal)
     values ($1, $2, school_timestamp($2::date, '08:00'),
       case when $3 then null else school_timestamp($2::date, '17:00') end, $4, $5) returning id`,
    [
      deployment,
      date,
      over.open ?? false,
      over.status ?? "pending",
      over.journal === undefined ? "Worked on the API" : over.journal,
    ],
  );
}

async function row(log: string) {
  return (
    await db.query<{
      status: string;
      time_in: string;
      time_out: string | null;
      break_minutes: number;
      reject_reason: string | null;
      correction_reason: string | null;
      reopen_reason: string | null;
      approved_by: string | null;
      added_by: string | null;
      journal: string | null;
    }>(
      "select status, time_in::text, time_out::text, break_minutes, reject_reason, correction_reason, reopen_reason, approved_by, added_by, journal from daily_logs where id = $1",
      [log],
    )
  ).rows[0];
}

async function approvedHours(deployment: string) {
  const hours = await db.query<{ approved_hours: string }>(
    "select approved_hours from deployment_hours where deployment_id = $1",
    [deployment],
  );
  return Number(hours.rows[0].approved_hours);
}

function call(sql: string, params: unknown[]) {
  return db.query(sql, params);
}

const approve = (actor: string, log: string) => call("select approve_log($1, $2)", [actor, log]);
const reject = (actor: string, log: string, reason: string | null) =>
  call("select reject_log($1, $2, $3)", [actor, log, reason]);
const correct = (
  actor: string,
  log: string,
  timeIn: string | null,
  timeOut: string | null,
  breakMinutes: number | null,
  reason: string | null,
) => call("select correct_log($1, $2, $3, $4, $5, $6)", [actor, log, timeIn, timeOut, breakMinutes, reason]);
const reopen = (actor: string, log: string, reason: string | null) =>
  call("select reopen_log($1, $2, $3)", [actor, log, reason]);
const addDay = (
  actor: string,
  deployment: string,
  date: string | null,
  timeIn: string | null,
  timeOut: string | null,
  breakMinutes: number | null,
  reason: string | null,
) =>
  call("select add_missed_day($1, $2, $3, $4, $5, $6, $7) as id", [
    actor,
    deployment,
    date,
    timeIn,
    timeOut,
    breakMinutes,
    reason,
  ]);

// A company with a supervisor and a student.
async function setup() {
  const acme = await company();
  return { acme, supervisor: await supervisorOf(acme), ...(await student(acme)) };
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

describe("who may review entries", () => {
  it.each(["student", "coordinator", "admin"])("refuses a %s", async (role) => {
    const { deployment } = await setup();
    const log = await entry(deployment);
    const actor = await insertUser(role);
    await expect(approve(actor, log)).rejects.toThrow(/forbidden/);
    await expect(reject(actor, log, "x")).rejects.toThrow(/forbidden/);
    await expect(correct(actor, log, "08:00", "17:00", 0, "x")).rejects.toThrow(/forbidden/);
    await expect(reopen(actor, log, "x")).rejects.toThrow(/forbidden/);
    expect((await row(log)).status).toBe("pending");
  });

  it("refuses an inactive supervisor", async () => {
    const { supervisor, deployment } = await setup();
    const log = await entry(deployment);
    await db.query("update users set is_active = false where id = $1", [supervisor]);
    await expect(approve(supervisor, log)).rejects.toThrow(/forbidden/);
  });

  it("reports another company's entry as not found and changes nothing", async () => {
    const { deployment } = await setup();
    const stranger = await supervisorOf(await company());
    const log = await entry(deployment);
    await expect(approve(stranger, log)).rejects.toThrow(/not_found/);
    await expect(reject(stranger, log, "x")).rejects.toThrow(/not_found/);
    await expect(correct(stranger, log, "08:00", "17:00", 0, "x")).rejects.toThrow(/not_found/);
    expect((await row(log)).status).toBe("pending");
  });

  it("cannot be called by the API roles", async () => {
    const { supervisor, deployment } = await setup();
    const log = await entry(deployment);
    await db.exec("set role authenticated");
    try {
      await expect(approve(supervisor, log)).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });
});

describe("approve_log", () => {
  it("approves a pending entry, and its hours then count", async () => {
    const { supervisor, deployment } = await setup();
    const log = await entry(deployment);
    expect(await approvedHours(deployment)).toBe(0);
    await approve(supervisor, log);
    expect(await row(log)).toMatchObject({ status: "approved", approved_by: supervisor });
    expect(await approvedHours(deployment)).toBe(9);
  });

  it("takes the break off the hours", async () => {
    const { supervisor, deployment } = await setup();
    const log = await entry(deployment);
    await correct(supervisor, log, "08:00", "17:00", 60, "Lunch");
    await approve(supervisor, log);
    expect(await approvedHours(deployment)).toBe(8);
  });

  it.each(["open", "approved", "rejected"])("refuses a %s entry", async (status) => {
    const { supervisor, deployment } = await setup();
    const log = await entry(deployment, { status, open: status === "open" });
    await expect(approve(supervisor, log)).rejects.toThrow(/only a pending entry/);
  });

  it("refuses an entry with no journal", async () => {
    const { supervisor, deployment } = await setup();
    const log = await entry(deployment, { journal: null });
    await expect(approve(supervisor, log)).rejects.toThrow(/needs a time out and a journal/);
    expect((await row(log)).status).toBe("pending");
  });

  it("audits the approval with the supervisor as the actor", async () => {
    const { supervisor, deployment } = await setup();
    const log = await entry(deployment);
    await approve(supervisor, log);
    const audit = await db.query<{ actor_id: string; new_value: Record<string, string> }>(
      "select actor_id, new_value from audit_log where table_name = 'daily_logs' and row_id = $1 and action = 'update'",
      [log],
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].actor_id).toBe(supervisor);
    expect(audit.rows[0].new_value.status).toBe("approved");
  });
});

describe("bulk_approve_logs", () => {
  const bulk = (actor: string, logs: string[]) =>
    call("select bulk_approve_logs($1, $2::uuid[]) as n", [actor, logs]);

  it("approves a chosen set and says how many", async () => {
    const { supervisor, deployment } = await setup();
    const logs = [
      await entry(deployment, { ago: 1 }),
      await entry(deployment, { ago: 2 }),
      await entry(deployment, { ago: 3 }),
    ];
    const result = await bulk(supervisor, [...logs, logs[0]]);
    expect((result.rows[0] as { n: number }).n).toBe(3);
    expect(await approvedHours(deployment)).toBe(27);
  });

  it("changes nothing when one entry is not pending", async () => {
    const { supervisor, deployment } = await setup();
    const good = await entry(deployment, { ago: 1 });
    const bad = await entry(deployment, { ago: 2, status: "rejected" });
    await expect(bulk(supervisor, [good, bad])).rejects.toThrow(/only a pending entry/);
    expect((await row(good)).status).toBe("pending");
  });

  it("changes nothing when one entry is another company's", async () => {
    const mine = await setup();
    const theirs = await setup();
    const good = await entry(mine.deployment, { ago: 1 });
    const foreign = await entry(theirs.deployment, { ago: 1 });
    await expect(bulk(mine.supervisor, [good, foreign])).rejects.toThrow(/not_found/);
    expect((await row(good)).status).toBe("pending");
    expect((await row(foreign)).status).toBe("pending");
  });

  it("refuses an empty list", async () => {
    const { supervisor } = await setup();
    await expect(bulk(supervisor, [])).rejects.toThrow(/choose between 1 and 200/);
  });
});

describe("reject_log", () => {
  it("rejects with a reason, and the student can fix and resubmit", async () => {
    const { supervisor, user, deployment } = await setup();
    const log = await entry(deployment);
    await reject(supervisor, log, "  Journal too short  ");
    expect(await row(log)).toMatchObject({ status: "rejected", reject_reason: "Journal too short" });

    await call("select resubmit_log($1, $2, $3)", [user, log, "A longer journal"]);
    expect(await row(log)).toMatchObject({ status: "pending", reject_reason: null });
  });

  it.each([null, "", "   "])("needs a reason (%j)", async (reason) => {
    const { supervisor, deployment } = await setup();
    const log = await entry(deployment);
    await expect(reject(supervisor, log, reason)).rejects.toThrow(/give a reason/);
    expect((await row(log)).status).toBe("pending");
  });

  it("refuses a reason over 500 characters and an entry that is not pending", async () => {
    const { supervisor, deployment } = await setup();
    const log = await entry(deployment);
    await expect(reject(supervisor, log, "x".repeat(501))).rejects.toThrow(/too long/);
    await approve(supervisor, log);
    await expect(reject(supervisor, log, "late")).rejects.toThrow(/only a pending entry/);
  });
});

describe("correct_log", () => {
  it("changes the times and break, and the audit log keeps the old values", async () => {
    const { supervisor, deployment } = await setup();
    const log = await entry(deployment);
    const before = await row(log);
    await correct(supervisor, log, "09:00", "16:30", 45, "Arrived late");
    const after = await row(log);
    expect(after).toMatchObject({
      status: "pending",
      break_minutes: 45,
      correction_reason: "Arrived late",
    });
    expect(after.time_in).not.toBe(before.time_in);

    const audit = await db.query<{
      old_value: Record<string, unknown>;
      new_value: Record<string, unknown>;
    }>(
      "select old_value, new_value from audit_log where table_name = 'daily_logs' and row_id = $1 and action = 'update'",
      [log],
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].old_value).toMatchObject({ break_minutes: 0 });
    expect(audit.rows[0].new_value).toMatchObject({ break_minutes: 45 });
    expect(audit.rows[0].old_value).toHaveProperty("time_in");
    expect(audit.rows[0].old_value).toHaveProperty("time_out");
  });

  it("accepts a night shift (time out earlier than time in)", async () => {
    const { supervisor, deployment } = await setup();
    const log = await entry(deployment);
    await correct(supervisor, log, "22:00", "06:00", 0, "Night shift");
    await approve(supervisor, log);
    expect(await approvedHours(deployment)).toBe(8);
  });

  it.each([
    ["no reason", "08:00", "17:00", 0, "  ", /give a reason for the correction/],
    ["a reason over 500", "08:00", "17:00", 0, "x".repeat(501), /too long/],
    ["the same in and out", "08:00", "08:00", 0, "Fix", /after the time in/],
    ["a negative break", "08:00", "17:00", -1, "Fix", /break cannot be longer/],
    ["a break over the time worked", "08:00", "09:00", 61, "Fix", /break cannot be longer/],
    ["no time out", "08:00", null, 0, "Fix", /both the time in and the time out/],
  ])("refuses %s and changes nothing", async (_name, timeIn, timeOut, breakMinutes, reason, message) => {
    const { supervisor, deployment } = await setup();
    const log = await entry(deployment);
    const before = await row(log);
    await expect(correct(supervisor, log, timeIn, timeOut, breakMinutes, reason)).rejects.toThrow(
      message,
    );
    expect(await row(log)).toEqual(before);
  });

  it("refuses an approved entry: reopen it first", async () => {
    const { supervisor, deployment } = await setup();
    const log = await entry(deployment);
    await approve(supervisor, log);
    await expect(correct(supervisor, log, "09:00", "17:00", 0, "Fix")).rejects.toThrow(
      /approved and locked/,
    );
  });

  it("sets a forgotten time out: an open entry with a journal becomes pending", async () => {
    const { supervisor, deployment } = await setup();
    const log = await entry(deployment, { status: "open", open: true });
    await correct(supervisor, log, "08:00", "17:00", 0, "Student forgot to time out");
    expect(await row(log)).toMatchObject({ status: "pending" });
    expect((await row(log)).time_out).not.toBeNull();
  });

  it("sends an open entry with no journal back to the student to write it", async () => {
    const { supervisor, user, deployment } = await setup();
    const log = await entry(deployment, { status: "open", open: true, journal: null });
    await correct(supervisor, log, "08:00", "17:00", 0, "Student forgot to time out");
    expect(await row(log)).toMatchObject({
      status: "rejected",
      reject_reason: expect.stringMatching(/Write your journal and resubmit/),
    });
    await call("select resubmit_log($1, $2, $3)", [user, log, "What I did"]);
    await approve(supervisor, log);
    expect(await approvedHours(deployment)).toBe(9);
  });
});

describe("reopen_log", () => {
  it("returns an approved entry to pending, with the reason, and its hours stop counting", async () => {
    const { supervisor, deployment } = await setup();
    const log = await entry(deployment);
    await approve(supervisor, log);
    await reopen(supervisor, log, "  Wrong break  ");
    expect(await row(log)).toMatchObject({
      status: "pending",
      reopen_reason: "Wrong break",
      approved_by: null,
    });
    expect(await approvedHours(deployment)).toBe(0);
    await correct(supervisor, log, "08:00", "17:00", 60, "Lunch break");
    await approve(supervisor, log);
    expect(await approvedHours(deployment)).toBe(8);
  });

  it("is audited with the supervisor as the actor", async () => {
    const { supervisor, deployment } = await setup();
    const log = await entry(deployment);
    await approve(supervisor, log);
    await reopen(supervisor, log, "Check again");
    const audit = await db.query<{ actor_id: string; new_value: Record<string, string> }>(
      "select actor_id, new_value from audit_log where table_name = 'daily_logs' and row_id = $1 and new_value ->> 'status' = 'pending' and old_value ->> 'status' = 'approved'",
      [log],
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].actor_id).toBe(supervisor);
    expect(audit.rows[0].new_value.reopen_reason).toBe("Check again");
  });

  it.each([null, "", "  "])("needs a reason (%j)", async (reason) => {
    const { supervisor, deployment } = await setup();
    const log = await entry(deployment);
    await approve(supervisor, log);
    await expect(reopen(supervisor, log, reason)).rejects.toThrow(/give a reason for reopening/);
    expect((await row(log)).status).toBe("approved");
  });

  it("refuses an entry that is not approved", async () => {
    const { supervisor, deployment } = await setup();
    const log = await entry(deployment);
    await expect(reopen(supervisor, log, "why")).rejects.toThrow(/only an approved entry/);
  });

  it("stays locked for a plain update outside the function", async () => {
    const { supervisor, deployment } = await setup();
    const log = await entry(deployment);
    await approve(supervisor, log);
    await expect(
      db.query("update daily_logs set journal = 'edited' where id = $1", [log]),
    ).rejects.toThrow(/locked/);
  });
});

describe("add_missed_day", () => {
  it("adds the day for the student to finish, then it can be approved", async () => {
    const { supervisor, user, deployment } = await setup();
    const date = await daysAgo(2);
    const log = await id("select add_missed_day($1, $2, $3, '08:00', '17:00', 60, $4) as id", [
      supervisor,
      deployment,
      date,
      "  Phone had no signal  ",
    ]);
    expect(await row(log)).toMatchObject({
      status: "rejected",
      reject_reason: expect.stringMatching(/Write your journal and resubmit/),
      correction_reason: "Phone had no signal",
      added_by: supervisor,
      break_minutes: 60,
      journal: null,
    });

    await call("select resubmit_log($1, $2, $3)", [user, log, "Fixed a bug"]);
    await approve(supervisor, log);
    expect(await approvedHours(deployment)).toBe(8);
  });

  it("is audited with the supervisor as the actor", async () => {
    const { supervisor, deployment } = await setup();
    const log = await id("select add_missed_day($1, $2, $3, '08:00', '17:00', 0, 'Offline') as id", [
      supervisor,
      deployment,
      await daysAgo(2),
    ]);
    const audit = await db.query<{ actor_id: string; action: string }>(
      "select actor_id, action from audit_log where table_name = 'daily_logs' and row_id = $1",
      [log],
    );
    expect(audit.rows).toEqual([{ actor_id: supervisor, action: "insert" }]);
  });

  it("accepts today but not a day in the future", async () => {
    const { supervisor, deployment } = await setup();
    await addDay(supervisor, deployment, await daysAgo(0), "08:00", "09:00", 0, "Today");
    const tomorrow = await daysAgo(-1);
    await expect(addDay(supervisor, deployment, tomorrow, "08:00", "09:00", 0, "Later")).rejects.toThrow(
      /future cannot be added/,
    );
  });

  it("refuses a day before the student was deployed", async () => {
    const { supervisor, deployment } = await setup();
    await expect(
      addDay(supervisor, deployment, await daysAgo(11), "08:00", "17:00", 0, "Too early"),
    ).rejects.toThrow(/before the student was deployed/);
  });

  it("refuses a day that already has an entry", async () => {
    const { supervisor, deployment } = await setup();
    await entry(deployment, { ago: 2 });
    await expect(
      addDay(supervisor, deployment, await daysAgo(2), "08:00", "17:00", 0, "Again"),
    ).rejects.toThrow(/already has an entry/);
  });

  it.each([
    ["no reason", "08:00", "17:00", 0, " ", /give a reason for adding the day/],
    ["the same in and out", "08:00", "08:00", 0, "Why", /after the time in/],
    ["a break over the time worked", "08:00", "09:00", 61, "Why", /break cannot be longer/],
    ["no time in", null, "17:00", 0, "Why", /give the date, the time in, and the time out/],
  ])("refuses %s and adds nothing", async (_name, timeIn, timeOut, breakMinutes, reason, message) => {
    const { supervisor, deployment } = await setup();
    await expect(
      addDay(supervisor, deployment, await daysAgo(2), timeIn, timeOut, breakMinutes, reason),
    ).rejects.toThrow(message);
    expect(
      (await db.query("select 1 from daily_logs where deployment_id = $1", [deployment])).rows,
    ).toHaveLength(0);
  });

  it("refuses a student of another company and a deployment that is not active", async () => {
    const { deployment } = await setup();
    const stranger = await supervisorOf(await company());
    await expect(
      addDay(stranger, deployment, await daysAgo(2), "08:00", "17:00", 0, "Sneaky"),
    ).rejects.toThrow(/not_found: student not found/);

    const acme = await company();
    const supervisor = await supervisorOf(acme);
    const ended = await student(acme, "ended");
    await expect(
      addDay(supervisor, ended.deployment, await daysAgo(2), "08:00", "17:00", 0, "Gone"),
    ).rejects.toThrow(/only an active deployment/);
  });

  it.each(["student", "coordinator", "admin"])("refuses a %s", async (role) => {
    const { deployment } = await setup();
    const actor = await insertUser(role);
    await expect(
      addDay(actor, deployment, await daysAgo(2), "08:00", "17:00", 0, "No"),
    ).rejects.toThrow(/forbidden/);
  });
});
