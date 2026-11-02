import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./harness";

let db: Db;
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

beforeAll(async () => {
  db = await createDb();
});

afterAll(async () => {
  await db.close();
});

describe("update_school_settings", () => {
  it("updates school settings and records audit log", async () => {
    const admin = await insertUser("admin");

    await db.query(
      "select update_school_settings($1::uuid, $2::text, $3::text, $4::text)",
      [admin, "PHINMA University of Iloilo - CITE", "Asia/Manila", "v2"],
    );

    const settings = (
      await db.query<{ name: string; timezone: string; consent_notice_version: string }>(
        "select name, timezone, consent_notice_version from school_settings where id = true",
      )
    ).rows[0];

    expect(settings.name).toBe("PHINMA University of Iloilo - CITE");
    expect(settings.timezone).toBe("Asia/Manila");
    expect(settings.consent_notice_version).toBe("v2");

    const auditRows = (
      await db.query<{ table_name: string; actor_id: string; action: string }>(
        "select table_name, actor_id, action from audit_log where table_name = 'school_settings'",
      )
    ).rows;

    expect(auditRows.length).toBeGreaterThanOrEqual(1);
    expect(auditRows[0].actor_id).toBe(admin);
    expect(auditRows[0].action).toBe("update");
  });

  it("refuses if caller is not an admin", async () => {
    const coordinator = await insertUser("coordinator");

    await expect(
      db.query("select update_school_settings($1::uuid, $2::text, $3::text, $4::text)", [
        coordinator,
        "New Name",
        "Asia/Manila",
        "v2",
      ]),
    ).rejects.toThrow(/forbidden/);
  });

  it("refuses blank fields", async () => {
    const admin = await insertUser("admin");

    await expect(
      db.query("select update_school_settings($1::uuid, $2::text, $3::text, $4::text)", [
        admin,
        "   ",
        "Asia/Manila",
        "v2",
      ]),
    ).rejects.toThrow(/invalid: school name cannot be blank/);

    await expect(
      db.query("select update_school_settings($1::uuid, $2::text, $3::text, $4::text)", [
        admin,
        "Valid Name",
        "",
        "v2",
      ]),
    ).rejects.toThrow(/invalid: timezone cannot be blank/);

    await expect(
      db.query("select update_school_settings($1::uuid, $2::text, $3::text, $4::text)", [
        admin,
        "Valid Name",
        "Asia/Manila",
        "  ",
      ]),
    ).rejects.toThrow(/invalid: consent notice version cannot be blank/);
  });
});
