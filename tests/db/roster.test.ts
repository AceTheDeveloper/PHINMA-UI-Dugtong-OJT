import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./harness";

let db: Db;
let counter = 0;

let admin: string;
let coordinatorA: string;
let coordinatorB: string;
let supervisor: string;
let student: string;
let inactiveCoordinator: string;
const unknown = "00000000-0000-0000-0000-000000000000";

let courseA: string;
let courseB: string;
let batchA: string;
let batchA2: string;
let batchB: string;
let closedBatch: string;

type Row = { row?: number; full_name?: unknown; student_number?: unknown; email?: unknown };

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

function row(n: number, overrides: Row = {}): Row {
  return {
    row: n + 1,
    full_name: `Student ${n}`,
    student_number: `N-${n}`,
    email: `student${n}@example.test`,
    ...overrides,
  };
}

// A fresh set of valid rows with numbers and emails that no other test uses.
let fresh = 1000;
function freshRows(count: number): Row[] {
  // row numbers are spreadsheet rows: the header is row 1, so data starts at 2
  return Array.from({ length: count }, (_, index) => {
    fresh += 1;
    return row(fresh, { row: index + 2 });
  });
}

function importRoster(actor: string, batch: string, rows: unknown) {
  return db.query<{ n: number }>(
    "select import_roster($1::uuid, $2::uuid, $3::jsonb) as n",
    [actor, batch, JSON.stringify(rows)],
  );
}

async function studentCount() {
  const result = await db.query<{ n: number }>("select count(*)::int as n from students");
  return result.rows[0].n;
}

beforeAll(async () => {
  db = await createDb();
  admin = await insertUser("admin");
  coordinatorA = await insertUser("coordinator");
  coordinatorB = await insertUser("coordinator");
  supervisor = await insertUser("supervisor");
  student = await insertUser("student");
  inactiveCoordinator = await insertUser("coordinator", false);

  const department = await id("select create_department($1, 'CITE', 'IT') as id", [admin]);
  courseA = await id("select create_course($1, $2, 'BSIT', 'IT') as id", [admin, department]);
  courseB = await id("select create_course($1, $2, 'BSCS', 'CS') as id", [admin, department]);
  batchA = await id("select create_ojt_batch($1, $2, '2026-2027', 486) as id", [admin, courseA]);
  batchA2 = await id("select create_ojt_batch($1, $2, '2027-2028', 486) as id", [admin, courseA]);
  batchB = await id("select create_ojt_batch($1, $2, '2026-2027', 486) as id", [admin, courseB]);
  closedBatch = await id("select create_ojt_batch($1, $2, '2025-2026', 486) as id", [admin, courseA]);
  await db.query("update ojt_batches set status = 'active' where id = $1", [closedBatch]);
  await db.query("update ojt_batches set status = 'closed' where id = $1", [closedBatch]);

  for (const [user, course] of [
    [coordinatorA, courseA],
    [inactiveCoordinator, courseA],
    [coordinatorB, courseB],
  ]) {
    await db.query("insert into coordinator_assignments (user_id, course_id) values ($1, $2)", [
      user,
      course,
    ]);
  }
});

afterAll(async () => {
  await db.close();
});

describe("import_roster: who may call it", () => {
  const refused: [string, () => string][] = [
    ["a supervisor", () => supervisor],
    ["a student", () => student],
    ["an inactive coordinator", () => inactiveCoordinator],
    ["an unknown user", () => unknown],
  ];

  for (const [label, actor] of refused) {
    it(`refuses ${label} and imports nothing`, async () => {
      const before = await studentCount();
      await expect(importRoster(actor(), batchA, freshRows(2))).rejects.toThrow(/forbidden/);
      expect(await studentCount()).toBe(before);
    });
  }

  it("refuses a coordinator of another course", async () => {
    const before = await studentCount();
    await expect(importRoster(coordinatorB, batchA, freshRows(2))).rejects.toThrow(
      /forbidden: this batch is not in one of your courses/,
    );
    expect(await studentCount()).toBe(before);
  });

  it("lets the assigned coordinator import and returns the count", async () => {
    const result = await importRoster(coordinatorA, batchA, freshRows(3));
    expect(result.rows[0].n).toBe(3);
  });

  it("lets an admin import into any course", async () => {
    const result = await importRoster(admin, batchB, freshRows(2));
    expect(result.rows[0].n).toBe(2);
  });

  it("refuses a batch that does not exist", async () => {
    await expect(importRoster(admin, unknown, freshRows(1))).rejects.toThrow(/not_found/);
  });

  it("refuses a closed batch", async () => {
    await expect(importRoster(admin, closedBatch, freshRows(1))).rejects.toThrow(
      /conflict: this OJT batch is closed/,
    );
  });

  it("cannot be called by a user session", async () => {
    await db.exec("set role authenticated");
    try {
      await expect(importRoster(admin, batchA, freshRows(1))).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      await db.exec("reset role");
    }
  });
});

describe("import_roster: what it stores", () => {
  it("stores trimmed values, a lower-cased email, and the batch's course", async () => {
    await importRoster(coordinatorA, batchA2, [
      {
        row: 2,
        full_name: "  Ana Reyes ",
        student_number: " 04-2122-041550 ",
        email: "  Ana.Reyes@Example.TEST ",
      },
    ]);
    const stored = await db.query<{
      full_name: string;
      student_number: string;
      email: string;
      course_id: string;
      ojt_batch_id: string;
      user_id: string | null;
    }>("select * from students where student_number = '04-2122-041550'");
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0]).toMatchObject({
      full_name: "Ana Reyes",
      student_number: "04-2122-041550",
      email: "ana.reyes@example.test",
      course_id: courseA,
      ojt_batch_id: batchA2,
      user_id: null,
    });
  });

  it("audits each student with the coordinator as the actor", async () => {
    const rows = freshRows(2);
    await importRoster(coordinatorA, batchA, rows);
    const audit = await db.query<{ actor_id: string; source: string; action: string }>(
      `select a.actor_id, a.source, a.action
         from audit_log a join students s on s.id::text = a.row_id
        where a.table_name = 'students' and s.student_number = $1`,
      [rows[0].student_number],
    );
    expect(audit.rows).toEqual([{ actor_id: coordinatorA, source: "app", action: "insert" }]);
  });

  it("imports 1000 rows in one call", async () => {
    const result = await importRoster(admin, batchA2, freshRows(1000));
    expect(result.rows[0].n).toBe(1000);
  });

  it("refuses more than 1000 rows", async () => {
    await expect(importRoster(admin, batchA2, freshRows(1001))).rejects.toThrow(
      /invalid: a roster can have at most 1000 rows/,
    );
  });

  it("refuses an empty roster and a roster that is not a list", async () => {
    await expect(importRoster(admin, batchA, [])).rejects.toThrow(/invalid: the roster has no rows/);
    await expect(importRoster(admin, batchA, { not: "a list" })).rejects.toThrow(/invalid/);
  });
});

describe("import_roster: a bad file imports nothing", () => {
  async function expectRolledBack(rows: Row[], message: RegExp) {
    const before = await studentCount();
    await expect(importRoster(coordinatorA, batchA, rows)).rejects.toThrow(message);
    expect(await studentCount()).toBe(before);
  }

  it("refuses a missing name, number, or email, naming the row", async () => {
    const good = freshRows(2);
    await expectRolledBack(
      [good[0], { ...good[1], row: 3, full_name: "  " }],
      /row 3: full name is required/,
    );
    await expectRolledBack(
      [{ ...good[0], student_number: null }],
      /row 2: student number is required/,
    );
    await expectRolledBack([{ ...good[0], email: "" }], /row 2: email is required/);
  });

  it("refuses an email that is not valid", async () => {
    await expectRolledBack([{ ...freshRows(1)[0], email: "not-an-email" }], /email is not valid/);
  });

  it("refuses a repeated student number or email inside the file", async () => {
    const [a, b] = freshRows(2);
    await expectRolledBack(
      [a, { ...b, row: 3, student_number: String(a.student_number).toLowerCase() }],
      /row 3: student number repeats row 2/,
    );
    await expectRolledBack([a, { ...b, row: 3, email: a.email }], /row 3: email repeats row 2/);
  });

  it("refuses a student number already in this batch", async () => {
    const [a] = freshRows(1);
    await importRoster(coordinatorA, batchA, [a]);
    await expectRolledBack(
      [{ ...freshRows(1)[0], student_number: a.student_number }],
      /student number is already in this batch/,
    );
  });

  it("refuses an email already on the roster", async () => {
    const [a] = freshRows(1);
    await importRoster(coordinatorA, batchA, [a]);
    await expectRolledBack(
      [{ ...freshRows(1)[0], email: a.email }],
      /email is already on the roster/,
    );
  });

  it("refuses an email that belongs to a student in another course", async () => {
    const [a] = freshRows(1);
    await importRoster(admin, batchB, [a]);
    await expectRolledBack(
      [{ ...freshRows(1)[0], email: a.email }],
      /email belongs to a student in another course/,
    );
  });

  it("refuses an email that already has an account", async () => {
    const [a] = freshRows(1);
    await db.query("update users set email = $1 where id = $2", [
      String(a.email).toUpperCase(),
      supervisor,
    ]);
    await expectRolledBack([a], /an account already uses this email/);
  });

  it("lets the same student number into a different batch", async () => {
    const [a] = freshRows(1);
    await importRoster(coordinatorA, batchA, [a]);
    const other = { ...freshRows(1)[0], student_number: a.student_number };
    const result = await importRoster(coordinatorA, batchA2, [other]);
    expect(result.rows[0].n).toBe(1);
  });

  it("reports every problem at once, and the first ten with a count of the rest", async () => {
    const rows = freshRows(12).map((r, index) => ({ ...r, row: index + 2, email: "" }));
    const before = await studentCount();
    await expect(importRoster(coordinatorA, batchA, rows)).rejects.toThrow(
      /row 2: email is required.*row 11: email is required \(and 2 more\)/,
    );
    expect(await studentCount()).toBe(before);
  });

  it("rolls back the good rows when one row is bad", async () => {
    const rows = freshRows(5);
    rows[3] = { ...rows[3], email: "bad" };
    await expectRolledBack(rows, /row 5: email is not valid/);
  });
});
