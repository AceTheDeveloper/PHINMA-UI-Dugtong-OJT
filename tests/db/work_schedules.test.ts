import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./harness";

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

async function deploymentAt(companyId: string, status = "active") {
  const user = await insertUser("student");
  counter += 1;
  const studentId = await id(
    `insert into students (user_id, course_id, ojt_batch_id, student_number, email, full_name)
     values ($1, $2, $3, $4, $5, 'Student') returning id`,
    [user, courseId, batchId, `SN-${counter}`, `student${counter}@example.test`],
  );
  return id(
    "insert into deployments (student_id, company_id, ojt_batch_id, status) values ($1, $2, $3, $4) returning id",
    [studentId, companyId, batchId, status],
  );
}

const weekdays = [
  { weekday: 1, start: "08:00", end: "17:00" },
  { weekday: 2, start: "08:00", end: "17:00" },
];

function setSchedule(actor: string, deployment: string, from: string, days: unknown = weekdays) {
  return db.query("select set_work_schedule($1, $2, $3, $4::jsonb)", [
    actor,
    deployment,
    from,
    JSON.stringify(days),
  ]);
}

async function inDays(n: number) {
  return (await db.query<{ d: string }>("select (school_today() + $1::int)::text as d", [n]))
    .rows[0].d;
}

async function scheduleCount(deployment: string) {
  return (
    await db.query("select 1 from work_schedules where deployment_id = $1", [deployment])
  ).rows.length;
}

beforeAll(async () => {
  db = await createDb();
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

describe("set_work_schedule", () => {
  it("lets the supervisor of the deployment's company set a schedule", async () => {
    const acme = await company();
    const supervisor = await supervisorOf(acme);
    const deployment = await deploymentAt(acme);

    const scheduleId = await id("select set_work_schedule($1, $2, $3, $4::jsonb) as id", [
      supervisor,
      deployment,
      await inDays(0),
      JSON.stringify(weekdays),
    ]);

    const days = await db.query<{ weekday: number; start_time: string; end_time: string }>(
      "select weekday, start_time::text, end_time::text from work_schedule_days where schedule_id = $1 order by weekday",
      [scheduleId],
    );
    expect(days.rows).toEqual([
      { weekday: 1, start_time: "08:00:00", end_time: "17:00:00" },
      { weekday: 2, start_time: "08:00:00", end_time: "17:00:00" },
    ]);
  });

  it("refuses a supervisor of another company and changes nothing", async () => {
    const acme = await company();
    const stranger = await supervisorOf(await company());
    const deployment = await deploymentAt(acme);

    await expect(setSchedule(stranger, deployment, await inDays(0))).rejects.toThrow(
      /not_found: student not found/,
    );
    expect(await scheduleCount(deployment)).toBe(0);
  });

  it.each(["student", "coordinator", "admin"])("refuses a %s", async (role) => {
    const deployment = await deploymentAt(await company());
    const actor = await insertUser(role);
    await expect(setSchedule(actor, deployment, await inDays(0))).rejects.toThrow(/forbidden/);
  });

  it("refuses an inactive supervisor", async () => {
    const acme = await company();
    const supervisor = await supervisorOf(acme);
    const deployment = await deploymentAt(acme);
    await db.query("update users set is_active = false where id = $1", [supervisor]);
    await expect(setSchedule(supervisor, deployment, await inDays(0))).rejects.toThrow(
      /forbidden/,
    );
  });

  it("refuses a deployment that is not active", async () => {
    const acme = await company();
    const supervisor = await supervisorOf(acme);
    const deployment = await deploymentAt(acme, "ended");
    await expect(setSchedule(supervisor, deployment, await inDays(0))).rejects.toThrow(
      /conflict: only an active deployment/,
    );
  });

  it("refuses a start date in the past", async () => {
    const acme = await company();
    const supervisor = await supervisorOf(acme);
    const deployment = await deploymentAt(acme);
    await expect(setSchedule(supervisor, deployment, await inDays(-1))).rejects.toThrow(
      /cannot start in the past/,
    );
  });

  it.each([
    ["no days", []],
    ["something that is not a list", { weekday: 1 }],
    ["a repeated weekday", [weekdays[0], weekdays[0]]],
    ["a weekday of 0", [{ weekday: 0, start: "08:00", end: "17:00" }]],
    ["a weekday of 8", [{ weekday: 8, start: "08:00", end: "17:00" }]],
    ["a badly written time", [{ weekday: 1, start: "8am", end: "17:00" }]],
    ["an hour of 24", [{ weekday: 1, start: "24:00", end: "17:00" }]],
    ["a missing end", [{ weekday: 1, start: "08:00" }]],
    ["the same start and end", [{ weekday: 1, start: "08:00", end: "08:00" }]],
  ])("refuses %s and writes nothing", async (_name, days) => {
    const acme = await company();
    const supervisor = await supervisorOf(acme);
    const deployment = await deploymentAt(acme);
    await expect(setSchedule(supervisor, deployment, await inDays(0), days)).rejects.toThrow(
      /invalid:/,
    );
    expect(await scheduleCount(deployment)).toBe(0);
  });

  it("accepts a night shift (end earlier than start)", async () => {
    const acme = await company();
    const supervisor = await supervisorOf(acme);
    const deployment = await deploymentAt(acme);
    await setSchedule(supervisor, deployment, await inDays(0), [
      { weekday: 5, start: "22:00", end: "06:00" },
    ]);
    expect(await scheduleCount(deployment)).toBe(1);
  });

  it("keeps the earlier schedule when a later one is added", async () => {
    const acme = await company();
    const supervisor = await supervisorOf(acme);
    const deployment = await deploymentAt(acme);
    await setSchedule(supervisor, deployment, await inDays(0));
    await setSchedule(supervisor, deployment, await inDays(7), [
      { weekday: 3, start: "09:00", end: "18:00" },
    ]);
    expect(await scheduleCount(deployment)).toBe(2);
  });

  it("replaces a schedule that starts on the same date", async () => {
    const acme = await company();
    const supervisor = await supervisorOf(acme);
    const deployment = await deploymentAt(acme);
    const from = await inDays(3);
    await setSchedule(supervisor, deployment, from);
    await setSchedule(supervisor, deployment, from, [
      { weekday: 4, start: "10:00", end: "19:00" },
    ]);
    const days = await db.query<{ weekday: number }>(
      `select d.weekday from work_schedule_days d
       join work_schedules s on s.id = d.schedule_id where s.deployment_id = $1`,
      [deployment],
    );
    expect(days.rows).toEqual([{ weekday: 4 }]);
  });

  it("audits the change with the supervisor as the actor", async () => {
    const acme = await company();
    const supervisor = await supervisorOf(acme);
    const deployment = await deploymentAt(acme);
    const scheduleId = await id("select set_work_schedule($1, $2, $3, $4::jsonb) as id", [
      supervisor,
      deployment,
      await inDays(0),
      JSON.stringify(weekdays),
    ]);
    const audit = await db.query<{ table_name: string; actor_id: string }>(
      "select table_name, actor_id from audit_log where row_id = $1 and table_name = 'work_schedules'",
      [scheduleId],
    );
    expect(audit.rows).toEqual([{ table_name: "work_schedules", actor_id: supervisor }]);
    const dayAudit = await db.query<{ actor_id: string }>(
      "select actor_id from audit_log where table_name = 'work_schedule_days' and new_value ->> 'schedule_id' = $1",
      [scheduleId],
    );
    expect(dayAudit.rows).toHaveLength(2);
    expect(dayAudit.rows.every((row) => row.actor_id === supervisor)).toBe(true);
  });

  it("cannot be called by the API roles", async () => {
    const acme = await company();
    const supervisor = await supervisorOf(acme);
    const deployment = await deploymentAt(acme);
    const from = await inDays(0);
    await db.exec("set role authenticated");
    try {
      await expect(setSchedule(supervisor, deployment, from)).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      await db.exec("reset role");
    }
  });
});

describe("work schedule tables", () => {
  it("are closed to API roles (RLS on, no policies)", async () => {
    const acme = await company();
    const supervisor = await supervisorOf(acme);
    const deployment = await deploymentAt(acme);
    await setSchedule(supervisor, deployment, await inDays(0));
    await db.exec("set role authenticated");
    try {
      expect((await db.query("select * from work_schedules")).rows).toHaveLength(0);
      expect((await db.query("select * from work_schedule_days")).rows).toHaveLength(0);
    } finally {
      await db.exec("reset role");
    }
  });
});
