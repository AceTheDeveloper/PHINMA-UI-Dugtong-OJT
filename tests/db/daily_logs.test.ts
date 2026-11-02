import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./harness";

let db: Db;
let courseId: string;
let batchId: string;
let companyId: string;
let adminId: string;
let studentUserId: string;
let studentId: string;
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

function insertStudent(userId: string, bId: string, cId: string) {
  counter += 1;
  return id(
    "insert into students (user_id, course_id, ojt_batch_id, student_number, email, full_name) values ($1, $2, $3, $4, $5, $6) returning id",
    [userId, cId, bId, `SN-${counter}`, `student${counter}@example.test`, `Student ${counter}`],
  );
}

beforeAll(async () => {
  db = await createDb();
  const dept = await id(
    "insert into departments (code, name) values ('CITE', 'College of IT') returning id",
  );
  courseId = await id(
    "insert into courses (department_id, code, name) values ($1, 'BSIT', 'BS Information Technology') returning id",
    [dept],
  );
  batchId = await id(
    "insert into ojt_batches (course_id, school_year, required_hours) values ($1, '2026-2027', 486) returning id",
    [courseId],
  );
  companyId = await id(
    "insert into companies (name, status) values ('Acme Partner Inc', 'active') returning id",
  );
  adminId = await insertUser("admin");
  studentUserId = await insertUser("student");
  studentId = await insertStudent(studentUserId, batchId, courseId);
});

afterAll(async () => {
  await db.close();
});

describe("deployments constraints and guard rails", () => {
  it("enforces at most one active deployment per student", async () => {
    const deploymentId = await id(
      "select create_deployment($1, $2, $3, null, $4) as id",
      [adminId, studentId, companyId, batchId],
    );
    expect(deploymentId).toBeDefined();

    // Trying to create a second active deployment for same student must fail
    await expect(
      id("select create_deployment($1, $2, $3, null, $4) as id", [
        adminId,
        studentId,
        companyId,
        batchId,
      ]),
    ).rejects.toThrow();

    // End the first deployment
    await db.query("update deployments set status = 'ended' where id = $1", [deploymentId]);

    // Now inserting another active deployment succeeds
    const secondDeploymentId = await id(
      "select create_deployment($1, $2, $3, null, $4) as id",
      [adminId, studentId, companyId, batchId],
    );
    expect(secondDeploymentId).toBeDefined();
    expect(secondDeploymentId).not.toBe(deploymentId);
  });
});

describe("daily_logs constraints and hours view", () => {
  it("enforces one daily log per deployment per day and computes hours", async () => {
    // Create new student and deployment for this test
    const sUserId = await insertUser("student");
    const sId = await insertStudent(sUserId, batchId, courseId);
    const depId = await id(
      "select create_deployment($1, $2, $3, null, $4) as id",
      [adminId, sId, companyId, batchId],
    );

    // Insert Log 1: 08:00 to 17:00 (9 hours = 540 min), break 60 min -> 480 min = 8.00 hours, approved
    const log1 = await id(
      `insert into daily_logs (
        deployment_id, log_date, time_in, time_out, break_minutes, journal, status
      ) values (
        $1, '2026-11-01', '2026-11-01T08:00:00+08:00', '2026-11-01T17:00:00+08:00', 60, 'Worked on task A', 'approved'
      ) returning id`,
      [depId],
    );
    expect(log1).toBeDefined();

    // Duplicate log on same day must fail
    await expect(
      db.query(
        `insert into daily_logs (
          deployment_id, log_date, time_in, time_out, status
        ) values (
          $1, '2026-11-01', '2026-11-01T09:00:00+08:00', '2026-11-01T12:00:00+08:00', 'open'
        )`,
        [depId],
      ),
    ).rejects.toThrow();

    // Insert Log 2: 08:00 to 12:00 (4 hours = 240 min), break 0 min -> 240 min = 4.00 hours, approved
    await db.query(
      `insert into daily_logs (
        deployment_id, log_date, time_in, time_out, break_minutes, journal, status
      ) values (
        $1, '2026-11-02', '2026-11-02T08:00:00+08:00', '2026-11-02T12:00:00+08:00', 0, 'Morning shift', 'approved'
      )`,
      [depId],
    );

    // Insert Log 3: 08:00 to 17:00, pending (should NOT count toward approved hours)
    await db.query(
      `insert into daily_logs (
        deployment_id, log_date, time_in, time_out, break_minutes, journal, status
      ) values (
        $1, '2026-11-03', '2026-11-03T08:00:00+08:00', '2026-11-03T17:00:00+08:00', 60, 'Pending review', 'pending'
      )`,
      [depId],
    );

    // Check deployment_hours view: 8.00 + 4.00 = 12.00 hours
    const hoursRow = (
      await db.query<{ approved_hours: string; approved_entries_count: number }>(
        "select approved_hours, approved_entries_count from deployment_hours where deployment_id = $1",
        [depId],
      )
    ).rows[0];

    expect(Number(hoursRow.approved_hours)).toBe(12.0);
    expect(hoursRow.approved_entries_count).toBe(2);
  });
});

describe("immutability of approved daily logs", () => {
  it("blocks direct modification or deletion of approved entries", async () => {
    const sUserId = await insertUser("student");
    const sId = await insertStudent(sUserId, batchId, courseId);
    const depId = await id(
      "select create_deployment($1, $2, $3, null, $4) as id",
      [adminId, sId, companyId, batchId],
    );

    const logId = await id(
      `insert into daily_logs (
        deployment_id, log_date, time_in, time_out, break_minutes, journal, status
      ) values (
        $1, '2026-11-01', '2026-11-01T08:00:00+08:00', '2026-11-01T17:00:00+08:00', 60, 'Day 1', 'approved'
      ) returning id`,
      [depId],
    );

    // Direct update should fail
    await expect(
      db.query("update daily_logs set journal = 'Tampered' where id = $1", [logId]),
    ).rejects.toThrow(/forbidden.*locked/);

    // Direct delete should fail
    await expect(
      db.query("delete from daily_logs where id = $1", [logId]),
    ).rejects.toThrow(/forbidden.*cannot be deleted/);
  });
});

describe("admin_reopen_daily_log", () => {
  it("reopens an approved entry to pending with audit logging and reasons", async () => {
    const sUserId = await insertUser("student");
    const sId = await insertStudent(sUserId, batchId, courseId);
    const depId = await id(
      "select create_deployment($1, $2, $3, null, $4) as id",
      [adminId, sId, companyId, batchId],
    );

    const supervisorId = await insertUser("supervisor");

    const logId = await id(
      `insert into daily_logs (
        deployment_id, log_date, time_in, time_out, break_minutes, journal, status, approved_by, approved_at
      ) values (
        $1, '2026-11-01', '2026-11-01T08:00:00+08:00', '2026-11-01T17:00:00+08:00', 60, 'Day 1', 'approved', $2, now()
      ) returning id`,
      [depId, supervisorId],
    );

    // Admin reopens the entry
    await db.query(
      "select admin_reopen_daily_log($1, $2, $3)",
      [adminId, logId, "Support ticket #456: Supervisor approved incorrect time out"],
    );

    const reopened = (
      await db.query<{
        status: string;
        approved_by: string | null;
        approved_at: string | null;
        reopen_reason: string;
        reopened_by: string;
      }>("select status, approved_by, approved_at, reopen_reason, reopened_by from daily_logs where id = $1", [
        logId,
      ])
    ).rows[0];

    expect(reopened.status).toBe("pending");
    expect(reopened.approved_by).toBeNull();
    expect(reopened.approved_at).toBeNull();
    expect(reopened.reopen_reason).toBe("Support ticket #456: Supervisor approved incorrect time out");
    expect(reopened.reopened_by).toBe(adminId);

    // Verify audit log has the update entry with admin actor
    const auditRows = (
      await db.query<{ action: string; actor_id: string; table_name: string }>(
        "select action, actor_id, table_name from audit_log where table_name = 'daily_logs' and row_id = $1 order by created_at desc limit 1",
        [logId],
      )
    ).rows;

    expect(auditRows.length).toBe(1);
    expect(auditRows[0].action).toBe("update");
    expect(auditRows[0].actor_id).toBe(adminId);
  });

  it("refuses non-admin actors", async () => {
    const studentUser = await insertUser("student");
    const sId = await insertStudent(studentUser, batchId, courseId);
    const depId = await id(
      "select create_deployment($1, $2, $3, null, $4) as id",
      [adminId, sId, companyId, batchId],
    );

    const logId = await id(
      `insert into daily_logs (
        deployment_id, log_date, time_in, time_out, status
      ) values (
        $1, '2026-11-01', '2026-11-01T08:00:00+08:00', '2026-11-01T17:00:00+08:00', 'approved'
      ) returning id`,
      [depId],
    );

    await expect(
      db.query("select admin_reopen_daily_log($1, $2, 'Reason')", [studentUser, logId]),
    ).rejects.toThrow(/forbidden.*admin/);
  });

  it("refuses blank support reasons", async () => {
    const sUserId = await insertUser("student");
    const sId = await insertStudent(sUserId, batchId, courseId);
    const depId = await id(
      "select create_deployment($1, $2, $3, null, $4) as id",
      [adminId, sId, companyId, batchId],
    );

    const logId = await id(
      `insert into daily_logs (
        deployment_id, log_date, time_in, time_out, status
      ) values (
        $1, '2026-11-01', '2026-11-01T08:00:00+08:00', '2026-11-01T17:00:00+08:00', 'approved'
      ) returning id`,
      [depId],
    );

    await expect(
      db.query("select admin_reopen_daily_log($1, $2, '   ')", [adminId, logId]),
    ).rejects.toThrow(/invalid.*support reason/);
  });

  it("refuses to reopen an unapproved entry", async () => {
    const sUserId = await insertUser("student");
    const sId = await insertStudent(sUserId, batchId, courseId);
    const depId = await id(
      "select create_deployment($1, $2, $3, null, $4) as id",
      [adminId, sId, companyId, batchId],
    );

    const logId = await id(
      `insert into daily_logs (
        deployment_id, log_date, time_in, status
      ) values (
        $1, '2026-11-01', '2026-11-01T08:00:00+08:00', 'open'
      ) returning id`,
      [depId],
    );

    await expect(
      db.query("select admin_reopen_daily_log($1, $2, 'Valid reason')", [adminId, logId]),
    ).rejects.toThrow(/invalid.*only approved/);
  });
});
