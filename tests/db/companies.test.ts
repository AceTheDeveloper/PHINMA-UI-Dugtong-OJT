import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./harness";

let db: Db;
let courseA: string;
let courseB: string;
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

function insertCompany(name: string) {
  return id("insert into companies (name) values ($1) returning id", [name]);
}

function addSupervisor(userId: string, companyId: string, isOwner: boolean) {
  return db.query(
    "insert into supervisor_memberships (user_id, company_id, is_owner) values ($1, $2, $3)",
    [userId, companyId, isOwner],
  );
}

beforeAll(async () => {
  db = await createDb();
  const dept = await id(
    "insert into departments (code, name) values ('D', 'Dept') returning id",
  );
  courseA = await id(
    "insert into courses (department_id, code, name) values ($1, 'A', 'A') returning id",
    [dept],
  );
  courseB = await id(
    "insert into courses (department_id, code, name) values ($1, 'B', 'B') returning id",
    [dept],
  );
});

afterAll(async () => {
  await db.close();
});

describe("companies", () => {
  it("rejects a duplicate name regardless of case", async () => {
    await insertCompany("Acme Software");
    await expect(insertCompany("ACME software")).rejects.toThrow(/duplicate key/);
  });

  it("defaults to active", async () => {
    const company = await insertCompany("Default Status Co");
    const row = await db.query<{ status: string }>(
      "select status from companies where id = $1",
      [company],
    );
    expect(row.rows[0].status).toBe("active");
  });
});

describe("supervisor_memberships", () => {
  it("allows one owner per company and rejects a second", async () => {
    const company = await insertCompany("Owner Co");
    await addSupervisor(await insertUser("supervisor"), company, true);
    await addSupervisor(await insertUser("supervisor"), company, false);
    await expect(
      addSupervisor(await insertUser("supervisor"), company, true),
    ).rejects.toThrow(/duplicate key/);
  });

  it("does not allow a supervisor in two companies", async () => {
    const supervisor = await insertUser("supervisor");
    await addSupervisor(supervisor, await insertCompany("First Co"), true);
    await expect(
      addSupervisor(supervisor, await insertCompany("Second Co"), true),
    ).rejects.toThrow(/duplicate key/);
  });

  it("rejects a user who is not a supervisor", async () => {
    const student = await insertUser("student");
    await expect(
      addSupervisor(student, await insertCompany("Role Co"), false),
    ).rejects.toThrow(/must have role supervisor/);
  });
});

describe("invitations", () => {
  let invitees = 0;

  function invite(fields: {
    role: string;
    studentId?: string | null;
    companyId?: string | null;
    courseId?: string | null;
  }) {
    invitees += 1;
    return db.query(
      `insert into invitations (email, role, student_id, company_id, course_id, expires_at)
       values ($1, $2, $3, $4, $5, now() + interval '7 days')`,
      [
        `invitee${invitees}@example.test`,
        fields.role,
        fields.studentId ?? null,
        fields.companyId ?? null,
        fields.courseId ?? null,
      ],
    );
  }

  it("requires a company for a supervisor invitation", async () => {
    await expect(invite({ role: "supervisor" })).rejects.toThrow(
      /check constraint/,
    );
    const company = await insertCompany("Invite Co");
    await expect(
      invite({ role: "supervisor", companyId: company }),
    ).resolves.toBeTruthy();
  });

  it("requires a student for a student invitation", async () => {
    await expect(invite({ role: "student" })).rejects.toThrow(/check constraint/);
  });

  it("requires a course for a coordinator invitation and rejects a company target", async () => {
    await expect(invite({ role: "coordinator" })).rejects.toThrow(
      /check constraint/,
    );
    await expect(
      invite({ role: "coordinator", courseId: courseA }),
    ).resolves.toBeTruthy();
    const company = await insertCompany("Wrong Target Co");
    await expect(
      invite({ role: "coordinator", courseId: courseA, companyId: company }),
    ).rejects.toThrow(/check constraint/);
  });

  it("changes status only from pending, and used needs used_at", async () => {
    const company = await insertCompany("Status Co");
    await invite({ role: "supervisor", companyId: company });
    const inviteId = await id("select id from invitations where company_id = $1", [
      company,
    ]);
    await expect(
      db.query("update invitations set status = 'used' where id = $1", [inviteId]),
    ).rejects.toThrow(/check constraint/);
    await db.query(
      "update invitations set status = 'used', used_at = now() where id = $1",
      [inviteId],
    );
    await expect(
      db.query(
        "update invitations set status = 'revoked', used_at = null where id = $1",
        [inviteId],
      ),
    ).rejects.toThrow(/cannot change/);
  });
});

describe("listings and listing_courses", () => {
  it("links one listing to several courses", async () => {
    const company = await insertCompany("Listing Co");
    const listing = await id(
      "insert into listings (company_id, title) values ($1, 'Intern') returning id",
      [company],
    );
    for (const course of [courseA, courseB]) {
      await db.query(
        "insert into listing_courses (listing_id, course_id) values ($1, $2)",
        [listing, course],
      );
    }
    await expect(
      db.query(
        "insert into listing_courses (listing_id, course_id) values ($1, $2)",
        [listing, courseA],
      ),
    ).rejects.toThrow(/duplicate key/);
  });

  it("detects a listing that has no course link", async () => {
    const company = await insertCompany("No Course Co");
    const orphan = await id(
      "insert into listings (company_id, title) values ($1, 'Orphan') returning id",
      [company],
    );
    const linked = await id(
      "insert into listings (company_id, title) values ($1, 'Linked') returning id",
      [company],
    );
    await db.query(
      "insert into listing_courses (listing_id, course_id) values ($1, $2)",
      [linked, courseA],
    );
    const found = await db.query<{ id: string }>(
      "select id from listings_without_courses where company_id = $1",
      [company],
    );
    expect(found.rows.map((r) => r.id)).toEqual([orphan]);
  });
});
