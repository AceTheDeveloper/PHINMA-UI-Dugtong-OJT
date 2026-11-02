import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./harness";

let db: Db;
let courseA: string;
let courseB: string;
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

function insertCompany(name: string, status = "active") {
  return id("insert into companies (name, status) values ($1, $2) returning id", [name, status]);
}

beforeAll(async () => {
  db = await createDb();
  const dept = await id(
    "insert into departments (code, name) values ('CITE', 'College of IT') returning id",
  );
  courseA = await id(
    "insert into courses (department_id, code, name) values ($1, 'BSIT', 'BS Information Technology') returning id",
    [dept],
  );
  courseB = await id(
    "insert into courses (department_id, code, name) values ($1, 'BSCS', 'BS Computer Science') returning id",
    [dept],
  );
});

afterAll(async () => {
  await db.close();
});

describe("create_listing", () => {
  it("creates a listing and attaches courses with audit logging", async () => {
    const admin = await insertUser("admin");
    const company = await insertCompany("TechCorp");

    const listingId = await id(
      "select create_listing($1::uuid, $2::uuid, $3::text, $4::text, $5::uuid[]) as id",
      [admin, company, "Frontend Developer Intern", "Work with React & Next.js", [courseA, courseB]],
    );

    expect(listingId).toBeDefined();

    const listing = (
      await db.query<{ title: string; description: string; status: string; created_by: string }>(
        "select title, description, status, created_by from listings where id = $1",
        [listingId],
      )
    ).rows[0];

    expect(listing.title).toBe("Frontend Developer Intern");
    expect(listing.description).toBe("Work with React & Next.js");
    expect(listing.status).toBe("open");
    expect(listing.created_by).toBe(admin);

    const courses = (
      await db.query<{ course_id: string }>(
        "select course_id from listing_courses where listing_id = $1 order by course_id",
        [listingId],
      )
    ).rows.map((r) => r.course_id);

    expect(courses).toEqual([courseA, courseB].sort());

    const auditRows = (
      await db.query<{ table_name: string; actor_id: string }>(
        "select table_name, actor_id from audit_log where row_id = $1",
        [listingId],
      )
    ).rows;

    expect(auditRows.length).toBeGreaterThanOrEqual(1);
    expect(auditRows[0].table_name).toBe("listings");
    expect(auditRows[0].actor_id).toBe(admin);
  });

  it("refuses if caller is not an admin", async () => {
    const student = await insertUser("student");
    const company = await insertCompany("Unauthorized Co");

    await expect(
      db.query(
        "select create_listing($1::uuid, $2::uuid, $3::text, $4::text, $5::uuid[])",
        [student, company, "Intern", "Desc", [courseA]],
      ),
    ).rejects.toThrow(/forbidden/);
  });

  it("refuses if company is inactive", async () => {
    const admin = await insertUser("admin");
    const company = await insertCompany("Inactive Co", "inactive");

    await expect(
      db.query(
        "select create_listing($1::uuid, $2::uuid, $3::text, $4::text, $5::uuid[])",
        [admin, company, "Intern", "Desc", [courseA]],
      ),
    ).rejects.toThrow(/invalid: company does not exist or is inactive/);
  });

  it("refuses blank title or empty course list", async () => {
    const admin = await insertUser("admin");
    const company = await insertCompany("Validation Co");

    await expect(
      db.query(
        "select create_listing($1::uuid, $2::uuid, $3::text, $4::text, $5::uuid[])",
        [admin, company, "   ", "Desc", [courseA]],
      ),
    ).rejects.toThrow(/invalid: title cannot be blank/);

    await expect(
      db.query(
        "select create_listing($1::uuid, $2::uuid, $3::text, $4::text, $5::uuid[])",
        [admin, company, "Intern", "Desc", []],
      ),
    ).rejects.toThrow(/invalid: a listing must be open to at least one course/);
  });
});

describe("update_listing", () => {
  it("updates listing title, description, and syncs course associations", async () => {
    const admin = await insertUser("admin");
    const company = await insertCompany("Update Co");

    const listingId = await id(
      "select create_listing($1::uuid, $2::uuid, $3::text, $4::text, $5::uuid[]) as id",
      [admin, company, "Old Title", "Old Desc", [courseA]],
    );

    await db.query(
      "select update_listing($1::uuid, $2::uuid, $3::text, $4::text, $5::uuid[])",
      [admin, listingId, "New Title", "New Desc", [courseB]],
    );

    const updated = (
      await db.query<{ title: string; description: string }>(
        "select title, description from listings where id = $1",
        [listingId],
      )
    ).rows[0];

    expect(updated.title).toBe("New Title");
    expect(updated.description).toBe("New Desc");

    const courses = (
      await db.query<{ course_id: string }>(
        "select course_id from listing_courses where listing_id = $1",
        [listingId],
      )
    ).rows.map((r) => r.course_id);

    expect(courses).toEqual([courseB]);
  });

  it("refuses update if listing does not exist", async () => {
    const admin = await insertUser("admin");
    const fakeId = "00000000-0000-4000-8000-000000000099";

    await expect(
      db.query(
        "select update_listing($1::uuid, $2::uuid, $3::text, $4::text, $5::uuid[])",
        [admin, fakeId, "Title", "Desc", [courseA]],
      ),
    ).rejects.toThrow(/not_found: listing not found/);
  });
});

describe("set_listing_status", () => {
  it("toggles listing status open and closed", async () => {
    const admin = await insertUser("admin");
    const company = await insertCompany("Status Co");

    const listingId = await id(
      "select create_listing($1::uuid, $2::uuid, $3::text, $4::text, $5::uuid[]) as id",
      [admin, company, "Role", "Desc", [courseA]],
    );

    await db.query("select set_listing_status($1::uuid, $2::uuid, 'closed'::listing_status)", [
      admin,
      listingId,
    ]);

    let status = (
      await db.query<{ status: string }>("select status from listings where id = $1", [listingId])
    ).rows[0].status;
    expect(status).toBe("closed");

    await db.query("select set_listing_status($1::uuid, $2::uuid, 'open'::listing_status)", [
      admin,
      listingId,
    ]);

    status = (
      await db.query<{ status: string }>("select status from listings where id = $1", [listingId])
    ).rows[0].status;
    expect(status).toBe("open");
  });

  it("refuses non-admin status change", async () => {
    const admin = await insertUser("admin");
    const coordinator = await insertUser("coordinator");
    const company = await insertCompany("Forbidden Status Co");

    const listingId = await id(
      "select create_listing($1::uuid, $2::uuid, $3::text, $4::text, $5::uuid[]) as id",
      [admin, company, "Role", "Desc", [courseA]],
    );

    await expect(
      db.query("select set_listing_status($1::uuid, $2::uuid, 'closed'::listing_status)", [
        coordinator,
        listingId,
      ]),
    ).rejects.toThrow(/forbidden/);
  });
});
