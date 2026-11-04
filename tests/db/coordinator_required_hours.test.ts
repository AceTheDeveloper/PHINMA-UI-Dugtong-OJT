import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asRole, createDb, type Db } from "./harness";

// Migration 22: set_ojt_required_hours accepts an admin or a coordinator of the
// batch's course, and nobody else. A coordinator may set at most 2000 hours.
// Every change is audited with the old value, the new value, and who.

let db: Db;
let counter = 0;

let admin: string;
let coordinator: string;
let otherCoordinator: string;
let inactiveCoordinator: string;
let supervisor: string;
let student: string;
let batch: string;
let otherBatch: string;
const unknown = "00000000-0000-0000-0000-000000000000";

async function id(sql: string, params: unknown[] = []) {
  return (await db.query<{ id: string }>(sql, params)).rows[0].id;
}

function insertUser(role: string, active = true) {
  counter += 1;
  return id(
    "insert into users (clerk_id, email, full_name, role, is_active) values ($1, $2, $3, $4, $5) returning id",
    [`clerk-${counter}`, `user${counter}@example.test`, `User ${counter}`, role, active],
  );
}

async function hoursOf(batchId: string) {
  const row = await db.query<{ required_hours: string }>(
    "select required_hours from ojt_batches where id = $1",
    [batchId],
  );
  return Number(row.rows[0].required_hours);
}

function setHours(actor: string, batchId: string, hours: number | null) {
  return db.query("select set_ojt_required_hours($1, $2, $3)", [actor, batchId, hours]);
}

beforeAll(async () => {
  db = await createDb();
  admin = await insertUser("admin");
  coordinator = await insertUser("coordinator");
  otherCoordinator = await insertUser("coordinator");
  inactiveCoordinator = await insertUser("coordinator", false);
  supervisor = await insertUser("supervisor");
  // a student account needs a roster record, so use a plain user row of that role
  student = await insertUser("student");

  const department = await id("select create_department($1, 'CITE', 'College of IT') as id", [admin]);
  const course = await id("select create_course($1, $2, 'BSIT', 'BS IT') as id", [admin, department]);
  const otherCourse = await id("select create_course($1, $2, 'BSCS', 'BS CS') as id", [admin, department]);
  batch = await id("select create_ojt_batch($1, $2, '2026-2027', 486) as id", [admin, course]);
  otherBatch = await id("select create_ojt_batch($1, $2, '2026-2027', 300) as id", [admin, otherCourse]);

  const assign = "insert into coordinator_assignments (user_id, course_id) values ($1, $2)";
  await db.query(assign, [coordinator, course]);
  await db.query(assign, [otherCoordinator, otherCourse]);
  await db.query(assign, [inactiveCoordinator, course]);
});

afterAll(async () => {
  await db.close();
});

describe("set_ojt_required_hours: who may call it", () => {
  it("lets the coordinator of the batch's course change it", async () => {
    await setHours(coordinator, batch, 500);
    expect(await hoursOf(batch)).toBe(500);
  });

  it("still lets an admin change it", async () => {
    await setHours(admin, batch, 486);
    expect(await hoursOf(batch)).toBe(486);
  });

  const refused: [string, () => string][] = [
    ["a coordinator of another course", () => otherCoordinator],
    ["an inactive coordinator of the course", () => inactiveCoordinator],
    ["a supervisor", () => supervisor],
    ["a student", () => student],
    ["an unknown user", () => unknown],
  ];

  for (const [label, actor] of refused) {
    it(`refuses ${label} and changes nothing`, async () => {
      await expect(setHours(actor(), batch, 100)).rejects.toThrow(/forbidden/);
      expect(await hoursOf(batch)).toBe(486);
    });
  }

  it("refuses a coordinator for another course's batch", async () => {
    await expect(setHours(coordinator, otherBatch, 100)).rejects.toThrow(/forbidden/);
    expect(await hoursOf(otherBatch)).toBe(300);
  });

  it("cannot be called from a browser session", async () => {
    for (const role of ["anon", "authenticated"] as const) {
      await expect(asRole(db, role, () => setHours(coordinator, batch, 100))).rejects.toThrow(
        /permission denied/,
      );
    }
    expect(await hoursOf(batch)).toBe(486);
  });
});

describe("set_ojt_required_hours: values", () => {
  it("refuses zero, negative, and missing hours", async () => {
    for (const hours of [0, -5, null]) {
      await expect(setHours(coordinator, batch, hours)).rejects.toThrow(/invalid/);
    }
    expect(await hoursOf(batch)).toBe(486);
  });

  it("lets a coordinator set exactly 2000 hours but not more", async () => {
    await setHours(coordinator, batch, 2000);
    expect(await hoursOf(batch)).toBe(2000);
    await expect(setHours(coordinator, batch, 2000.5)).rejects.toThrow(/invalid: required hours can be at most 2000/);
    expect(await hoursOf(batch)).toBe(2000);
    await setHours(coordinator, batch, 486);
  });

  it("keeps the admin's limit as it was", async () => {
    await setHours(admin, batch, 2500);
    expect(await hoursOf(batch)).toBe(2500);
    await setHours(admin, batch, 486);
  });

  it("refuses a batch that does not exist", async () => {
    await expect(setHours(coordinator, unknown, 200)).rejects.toThrow(/not_found/);
  });
});

describe("set_ojt_required_hours: audit", () => {
  it("records the coordinator's change with the old value, new value, and who", async () => {
    await setHours(coordinator, batch, 450);
    const rows = await db.query<{
      action: string;
      old_value: Record<string, unknown>;
      new_value: Record<string, unknown>;
      actor_id: string;
      source: string;
      created_at: string;
    }>("select * from audit_log where table_name = 'ojt_batches' and row_id = $1 order by id", [batch]);
    const change = rows.rows[rows.rows.length - 1];
    expect(change).toMatchObject({ action: "update", actor_id: coordinator, source: "app" });
    expect(Number(change.old_value.required_hours)).toBe(486);
    expect(Number(change.new_value.required_hours)).toBe(450);
    expect(change.created_at).toBeTruthy();
  });
});
