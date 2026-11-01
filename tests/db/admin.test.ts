import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./harness";

let db: Db;
let counter = 0;

let admin: string;
let coordinator: string;
let supervisor: string;
let student: string;
let inactiveAdmin: string;
const unknown = "00000000-0000-0000-0000-000000000000";

let department: string;
let course: string;
let batch: string;
let company: string;

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

function newCode() {
  counter += 1;
  return `C${counter}`;
}

type AuditRow = {
  table_name: string;
  row_id: string;
  action: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  actor_id: string | null;
  source: string;
};

async function auditFor(table: string, rowId: string) {
  const result = await db.query<AuditRow>(
    "select * from audit_log where table_name = $1 and row_id = $2 order by id",
    [table, rowId],
  );
  return result.rows;
}

beforeAll(async () => {
  db = await createDb();
  admin = await insertUser("admin");
  coordinator = await insertUser("coordinator");
  supervisor = await insertUser("supervisor");
  inactiveAdmin = await insertUser("admin", false);
  // a student account needs a roster record, so use a plain user row of that role
  student = await insertUser("student");

  department = await id("select create_department($1, 'CITE', 'College of IT') as id", [admin]);
  course = await id("select create_course($1, $2, 'BSIT', 'BS Information Technology') as id", [
    admin,
    department,
  ]);
  batch = await id("select create_ojt_batch($1, $2, '2026-2027', 486) as id", [admin, course]);
  company = await id("select create_company($1, 'Acme Corp', 'Iloilo City') as id", [admin]);
});

afterAll(async () => {
  await db.close();
});

describe("admin write functions: who may call them", () => {
  const calls: { name: string; run: (actor: string) => Promise<unknown> }[] = [
    {
      name: "create_department",
      run: (actor) => db.query("select create_department($1, 'X1', 'X')", [actor]),
    },
    {
      name: "create_course",
      run: (actor) =>
        db.query("select create_course($1, $2, 'X1', 'X')", [actor, department]),
    },
    {
      name: "create_ojt_batch",
      run: (actor) =>
        db.query("select create_ojt_batch($1, $2, '2030-2031', 100)", [actor, course]),
    },
    {
      name: "set_ojt_required_hours",
      run: (actor) =>
        db.query("select set_ojt_required_hours($1, $2, 300)", [actor, batch]),
    },
    {
      name: "create_company",
      run: (actor) => db.query("select create_company($1, 'Refused Co')", [actor]),
    },
    {
      name: "set_company_status",
      run: (actor) =>
        db.query("select set_company_status($1, $2, 'inactive')", [actor, company]),
    },
  ];

  const refused: [string, () => string][] = [
    ["a coordinator", () => coordinator],
    ["a supervisor", () => supervisor],
    ["a student", () => student],
    ["an inactive admin", () => inactiveAdmin],
    ["an unknown user", () => unknown],
  ];

  for (const call of calls) {
    for (const [label, actor] of refused) {
      it(`${call.name} refuses ${label}`, async () => {
        await expect(call.run(actor())).rejects.toThrow(/forbidden/);
      });
    }
  }

  it("changes nothing when refused", async () => {
    const before = await db.query<{ n: number }>("select count(*)::int as n from companies");
    await expect(
      db.query("select create_company($1, 'Refused Co')", [coordinator]),
    ).rejects.toThrow(/forbidden/);
    const after = await db.query<{ n: number }>("select count(*)::int as n from companies");
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });
});

describe("departments and courses", () => {
  it("rejects a duplicate department code, ignoring case", async () => {
    await expect(
      db.query("select create_department($1, 'cite', 'Another')", [admin]),
    ).rejects.toThrow(/conflict/);
  });

  it("rejects a blank department name", async () => {
    await expect(
      db.query("select create_department($1, 'BLANK', '   ')", [admin]),
    ).rejects.toThrow(/invalid/);
  });

  it("rejects a duplicate course code in the same department", async () => {
    await expect(
      db.query("select create_course($1, $2, 'bsit', 'Again')", [admin, department]),
    ).rejects.toThrow(/conflict/);
  });

  it("allows the same course code in another department", async () => {
    const other = await id("select create_department($1, $2, 'Other') as id", [
      admin,
      newCode(),
    ]);
    await expect(
      db.query("select create_course($1, $2, 'BSIT', 'Same code') as id", [admin, other]),
    ).resolves.toBeDefined();
  });

  it("refuses a course for a department that does not exist", async () => {
    await expect(
      db.query("select create_course($1, $2, 'ZZ', 'Nope')", [admin, unknown]),
    ).rejects.toThrow(/not_found/);
  });
});

describe("OJT batches", () => {
  it("stores required hours as data on the batch", async () => {
    const row = await db.query<{ required_hours: string }>(
      "select required_hours from ojt_batches where id = $1",
      [batch],
    );
    expect(Number(row.rows[0].required_hours)).toBe(486);
  });

  it("rejects a second batch for the same course and school year", async () => {
    await expect(
      db.query("select create_ojt_batch($1, $2, '2026-2027', 100)", [admin, course]),
    ).rejects.toThrow(/conflict/);
  });

  it("rejects a malformed school year", async () => {
    await expect(
      db.query("select create_ojt_batch($1, $2, '2026-2028', 100)", [admin, course]),
    ).rejects.toThrow(/invalid/);
  });

  it("rejects zero or negative required hours", async () => {
    await expect(
      db.query("select create_ojt_batch($1, $2, '2031-2032', 0)", [admin, course]),
    ).rejects.toThrow(/invalid/);
    await expect(
      db.query("select set_ojt_required_hours($1, $2, -5)", [admin, batch]),
    ).rejects.toThrow(/invalid/);
  });

  it("rejects an end date before the start date", async () => {
    await expect(
      db.query(
        "select create_ojt_batch($1, $2, '2032-2033', 100, '2033-01-10', '2033-01-01')",
        [admin, course],
      ),
    ).rejects.toThrow(/invalid/);
  });

  it("refuses a batch for a course that does not exist", async () => {
    await expect(
      db.query("select create_ojt_batch($1, $2, '2034-2035', 100)", [admin, unknown]),
    ).rejects.toThrow(/not_found/);
  });

  it("refuses to change hours of a batch that does not exist", async () => {
    await expect(
      db.query("select set_ojt_required_hours($1, $2, 200)", [admin, unknown]),
    ).rejects.toThrow(/not_found/);
  });
});

describe("companies", () => {
  it("rejects a duplicate company name, ignoring case", async () => {
    await expect(
      db.query("select create_company($1, 'ACME CORP')", [admin]),
    ).rejects.toThrow(/conflict/);
  });

  it("rejects a blank company name", async () => {
    await expect(db.query("select create_company($1, '  ')", [admin])).rejects.toThrow(
      /invalid/,
    );
  });

  it("refuses to change the status of a company that does not exist", async () => {
    await expect(
      db.query("select set_company_status($1, $2, 'inactive')", [admin, unknown]),
    ).rejects.toThrow(/not_found/);
  });
});

describe("audit log", () => {
  it("records a created department with the actor and no old value", async () => {
    const rows = await auditFor("departments", department);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "insert", actor_id: admin, source: "app" });
    expect(rows[0].old_value).toBeNull();
    expect(rows[0].new_value).toMatchObject({ code: "CITE" });
  });

  it("records a required hours change as old and new value only", async () => {
    await db.query("select set_ojt_required_hours($1, $2, 500)", [admin, batch]);
    const rows = await auditFor("ojt_batches", batch);
    const change = rows[rows.length - 1];
    expect(change.action).toBe("update");
    expect(change.actor_id).toBe(admin);
    expect(Number(change.old_value?.required_hours)).toBe(486);
    expect(Number(change.new_value?.required_hours)).toBe(500);
    expect(Object.keys(change.new_value ?? {})).toEqual(["required_hours"]);
  });

  it("records a company status change", async () => {
    await db.query("select set_company_status($1, $2, 'inactive')", [admin, company]);
    await db.query("select set_company_status($1, $2, 'active')", [admin, company]);
    const rows = await auditFor("companies", company);
    const changes = rows.filter((row) => row.action === "update");
    expect(changes).toHaveLength(2);
    expect(changes[0].old_value).toEqual({ status: "active" });
    expect(changes[0].new_value).toEqual({ status: "inactive" });
  });

  it("does not record an update that changes nothing", async () => {
    const before = (await auditFor("companies", company)).length;
    await db.query("select set_company_status($1, $2, 'active')", [admin, company]);
    expect((await auditFor("companies", company)).length).toBe(before);
  });

  it("records invitations without the Clerk invitation id", async () => {
    const invitation = await id(
      "select create_invitation($1::uuid, 'coordinator'::user_role, 'coord@example.test', null, null, $2::uuid) as id",
      [admin, course],
    );
    await db.query("select set_invitation_clerk_id($1, $2, 'inv_secret_123')", [
      admin,
      invitation,
    ]);
    // attaching the Clerk id changes only a hidden column, so it writes no row
    await db.query("select revoke_invitation($1, $2)", [admin, invitation]);
    const rows = await auditFor("invitations", invitation);
    expect(rows.map((row) => row.action)).toEqual(["insert", "update"]);
    expect(rows[1].new_value).toEqual({ status: "revoked" });
    expect(JSON.stringify(rows)).not.toContain("inv_secret_123");
    expect(JSON.stringify(rows)).not.toContain("clerk_invitation_id");
  });

  it("records a new account without the Clerk id, and names the person as the actor", async () => {
    const invitation = await id(
      "select create_invitation($1::uuid, 'supervisor'::user_role, 'sup@example.test', null, $2::uuid) as id",
      [admin, company],
    );
    const userId = await id("select accept_invitation('clerk-audit-1', 'sup@example.test', 'Sup', $1::uuid) as id", [
      invitation,
    ]);
    const rows = await auditFor("users", userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "insert", actor_id: userId, source: "app" });
    expect(JSON.stringify(rows)).not.toContain("clerk-audit-1");
    const membership = await auditFor("supervisor_memberships", userId);
    expect(membership[0].new_value).toMatchObject({ is_owner: true });
  });

  it("records an edit made outside the app with source database and no actor", async () => {
    await db.query("update companies set address = 'Changed in SQL editor' where id = $1", [
      company,
    ]);
    const rows = await auditFor("companies", company);
    const last = rows[rows.length - 1];
    expect(last).toMatchObject({ source: "database", actor_id: null });
    expect(last.new_value).toEqual({ address: "Changed in SQL editor" });
  });

  it("cannot be updated, deleted, or truncated", async () => {
    await expect(db.query("update audit_log set action = 'delete'")).rejects.toThrow(
      /audit rows cannot be changed/,
    );
    await expect(db.query("delete from audit_log")).rejects.toThrow(
      /audit rows cannot be changed/,
    );
    await expect(db.query("truncate audit_log")).rejects.toThrow(
      /audit rows cannot be changed/,
    );
  });

  it("is unreadable and unwritable for user sessions", async () => {
    await db.exec("set role authenticated");
    try {
      const read = await db.query("select * from audit_log");
      expect(read.rows).toHaveLength(0);
      await expect(
        db.query(
          "insert into audit_log (table_name, row_id, action, source) values ('x', 'y', 'insert', 'app')",
        ),
      ).rejects.toThrow();
    } finally {
      await db.exec("reset role");
    }
  });

  it("cannot be called by user sessions", async () => {
    await db.exec("set role authenticated");
    try {
      await expect(
        db.query("select create_department($1, 'HACK', 'Hack')", [admin]),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });
});
