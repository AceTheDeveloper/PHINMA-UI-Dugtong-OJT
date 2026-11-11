import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asRole, createDb, type Db } from "./harness";

// Migration 24: Clerk webhook synchronization (ticket-38).
// clerk_sync_user_email updates primary email and records audit.
// clerk_deactivate_user marks account inactive and records audit.
// Both functions are callable only by service_role.

let db: Db;
let counter = 0;

async function insertUser(opts: {
  clerkId?: string;
  email?: string;
  role?: string;
  active?: boolean;
} = {}) {
  counter += 1;
  const clerkId = opts.clerkId ?? `clerk-webhook-${counter}`;
  const email = opts.email ?? `user${counter}@example.test`;
  const role = opts.role ?? "student";
  const active = opts.active ?? true;

  const res = await db.query<{ id: string }>(
    `insert into users (clerk_id, email, full_name, role, is_active)
     values ($1, $2, $3, $4, $5) returning id`,
    [clerkId, email, `User ${counter}`, role, active],
  );
  return { id: res.rows[0].id, clerkId, email };
}

beforeAll(async () => {
  db = await createDb();
});

afterAll(async () => {
  await db.close();
});

describe("clerk_sync_user_email", () => {
  it("updates user email and writes to audit_log", async () => {
    const user = await insertUser({ email: "old-email@example.test" });
    const newEmail = "new-email@example.test";

    await asRole(db, "service_role", () =>
      db.query("select clerk_sync_user_email($1, $2)", [user.clerkId, newEmail]),
    );

    const userRow = await db.query<{ email: string; is_active: boolean }>(
      "select email, is_active from users where id = $1",
      [user.id],
    );
    expect(userRow.rows[0].email).toBe(newEmail);

    const auditRow = await db.query<{
      actor_id: string;
      action: string;
      table_name: string;
      old_value: { email: string };
      new_value: { email: string };
    }>(
      `select actor_id, action, table_name, old_value, new_value
       from audit_log where table_name = 'users' and row_id = $1
       order by created_at desc limit 1`,
      [user.id],
    );

    expect(auditRow.rows[0].actor_id).toBe(user.id);
    expect(auditRow.rows[0].action).toBe("update");
    expect(auditRow.rows[0].old_value.email).toBe("old-email@example.test");
    expect(auditRow.rows[0].new_value.email).toBe(newEmail);
  });

  it("no-ops cleanly when clerk_id is not found", async () => {
    await asRole(db, "service_role", () =>
      db.query("select clerk_sync_user_email($1, $2)", [
        "clerk-nonexistent-id",
        "some@example.test",
      ]),
    );
  });

  it("no-ops cleanly when email is unchanged", async () => {
    const user = await insertUser({ email: "same@example.test" });
    const beforeAuditCount = (
      await db.query<{ count: string }>(
        "select count(*) from audit_log where row_id = $1",
        [user.id],
      )
    ).rows[0].count;

    await asRole(db, "service_role", () =>
      db.query("select clerk_sync_user_email($1, $2)", [user.clerkId, "same@example.test"]),
    );

    const afterAuditCount = (
      await db.query<{ count: string }>(
        "select count(*) from audit_log where row_id = $1",
        [user.id],
      )
    ).rows[0].count;

    expect(afterAuditCount).toBe(beforeAuditCount);
  });

  it("fails with conflict if new email is already taken by another user", async () => {
    const user1 = await insertUser({ email: "first@example.test" });
    const user2 = await insertUser({ email: "second@example.test" });

    await expect(
      asRole(db, "service_role", () =>
        db.query("select clerk_sync_user_email($1, $2)", [user2.clerkId, user1.email]),
      ),
    ).rejects.toThrow(/conflict: email is already taken/);
  });

  it("fails with invalid if clerk_id or email is empty", async () => {
    await expect(
      asRole(db, "service_role", () =>
        db.query("select clerk_sync_user_email($1, $2)", ["", "test@example.test"]),
      ),
    ).rejects.toThrow(/invalid: clerk_id is required/);

    await expect(
      asRole(db, "service_role", () =>
        db.query("select clerk_sync_user_email($1, $2)", ["clerk-some", "  "]),
      ),
    ).rejects.toThrow(/invalid: email is required/);
  });

  it("is denied to anon and authenticated callers", async () => {
    const user = await insertUser();

    await expect(
      asRole(db, "anon", () =>
        db.query("select clerk_sync_user_email($1, $2)", [user.clerkId, "x@example.test"]),
      ),
    ).rejects.toThrow(/permission denied/);

    await expect(
      asRole(db, "authenticated", () =>
        db.query("select clerk_sync_user_email($1, $2)", [user.clerkId, "x@example.test"]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("clerk_deactivate_user", () => {
  it("deactivates user and writes to audit_log", async () => {
    const user = await insertUser({ active: true });

    await asRole(db, "service_role", () =>
      db.query("select clerk_deactivate_user($1)", [user.clerkId]),
    );

    const userRow = await db.query<{ is_active: boolean }>(
      "select is_active from users where id = $1",
      [user.id],
    );
    expect(userRow.rows[0].is_active).toBe(false);

    const auditRow = await db.query<{
      actor_id: string;
      action: string;
      table_name: string;
      old_value: { is_active: boolean };
      new_value: { is_active: boolean };
    }>(
      `select actor_id, action, table_name, old_value, new_value
       from audit_log where table_name = 'users' and row_id = $1
       order by created_at desc limit 1`,
      [user.id],
    );

    expect(auditRow.rows[0].actor_id).toBe(user.id);
    expect(auditRow.rows[0].old_value.is_active).toBe(true);
    expect(auditRow.rows[0].new_value.is_active).toBe(false);
  });

  it("no-ops cleanly when clerk_id is not found", async () => {
    await asRole(db, "service_role", () =>
      db.query("select clerk_deactivate_user($1)", ["clerk-nonexistent-id"]),
    );
  });

  it("no-ops cleanly when user is already inactive", async () => {
    const user = await insertUser({ active: false });
    const beforeAuditCount = (
      await db.query<{ count: string }>(
        "select count(*) from audit_log where row_id = $1",
        [user.id],
      )
    ).rows[0].count;

    await asRole(db, "service_role", () =>
      db.query("select clerk_deactivate_user($1)", [user.clerkId]),
    );

    const afterAuditCount = (
      await db.query<{ count: string }>(
        "select count(*) from audit_log where row_id = $1",
        [user.id],
      )
    ).rows[0].count;

    expect(afterAuditCount).toBe(beforeAuditCount);
  });

  it("fails with invalid if clerk_id is empty", async () => {
    await expect(
      asRole(db, "service_role", () => db.query("select clerk_deactivate_user($1)", [""])),
    ).rejects.toThrow(/invalid: clerk_id is required/);
  });

  it("is denied to anon and authenticated callers", async () => {
    const user = await insertUser();

    await expect(
      asRole(db, "anon", () =>
        db.query("select clerk_deactivate_user($1)", [user.clerkId]),
      ),
    ).rejects.toThrow(/permission denied/);

    await expect(
      asRole(db, "authenticated", () =>
        db.query("select clerk_deactivate_user($1)", [user.clerkId]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
