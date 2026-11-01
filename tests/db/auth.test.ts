import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asRole, createDb, type Db } from "./harness";

let db: Db;
let counter = 0;

let courseA: string;
let courseB: string;
let batchA: string;
let batchB: string;
let company1: string;
let company2: string;

let admin: string;
let coordinatorA: string;
let coordinatorB: string;
let coordinatorAB: string;
let owner1: string;
let member1: string;
let owner2: string;
let studentUserA: string;
let studentUserB: string;

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

function insertStudent(course: string, batch: string, userId: string | null) {
  counter += 1;
  return id(
    `insert into students (user_id, course_id, ojt_batch_id, student_number, email, full_name)
     values ($1, $2, $3, $4, $5, 'Student') returning id`,
    [userId, course, batch, `N-${counter}`, `student${counter}@example.test`],
  );
}

function email() {
  counter += 1;
  return `invitee${counter}@example.test`;
}

type Target = { student?: string; company?: string; course?: string };

function createInvitation(
  actor: string,
  role: string,
  to: string,
  target: Target = {},
  days = 7,
) {
  return db.query<{ id: string }>(
    `select create_invitation($1::uuid, $2::user_role, $3, $4::uuid, $5::uuid, $6::uuid, $7::int) as id`,
    [
      actor,
      role,
      to,
      target.student ?? null,
      target.company ?? null,
      target.course ?? null,
      days,
    ],
  );
}

// Direct insert so tests control status and expiry.
function makeInvitation(fields: {
  email: string;
  role: string;
  target?: Target;
  status?: string;
  minutes?: number;
}) {
  const target = fields.target ?? {};
  return id(
    `insert into invitations (email, role, student_id, company_id, course_id, status, expires_at, used_at)
     values ($1, $2::user_role, $3, $4, $5, $6::invitation_status,
             now() + ($7::text || ' minutes')::interval,
             case when $6 = 'used' then now() end)
     returning id`,
    [
      fields.email,
      fields.role,
      target.student ?? null,
      target.company ?? null,
      target.course ?? null,
      fields.status ?? "pending",
      String(fields.minutes ?? 60),
    ],
  );
}

function acceptInvitation(
  clerkId: string,
  to: string,
  name: string,
  invitation: string,
) {
  return db.query<{ id: string }>(
    "select accept_invitation($1, $2, $3, $4::uuid) as id",
    [clerkId, to, name, invitation],
  );
}

function newClerkId() {
  counter += 1;
  return `clerk-new-${counter}`;
}

async function usersWithClerkId(clerkId: string) {
  const result = await db.query("select 1 from users where clerk_id = $1", [
    clerkId,
  ]);
  return result.rows.length;
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
  batchA = await id(
    "insert into ojt_batches (course_id, school_year, required_hours) values ($1, '2026-2027', 300) returning id",
    [courseA],
  );
  batchB = await id(
    "insert into ojt_batches (course_id, school_year, required_hours) values ($1, '2026-2027', 300) returning id",
    [courseB],
  );
  company1 = await id("insert into companies (name) values ('Company One') returning id");
  company2 = await id("insert into companies (name) values ('Company Two') returning id");

  admin = await insertUser("admin");
  coordinatorA = await insertUser("coordinator");
  coordinatorB = await insertUser("coordinator");
  coordinatorAB = await insertUser("coordinator");
  owner1 = await insertUser("supervisor");
  member1 = await insertUser("supervisor");
  owner2 = await insertUser("supervisor");
  studentUserA = await insertUser("student");
  studentUserB = await insertUser("student");

  for (const [user, course] of [
    [coordinatorA, courseA],
    [coordinatorB, courseB],
    [coordinatorAB, courseA],
    [coordinatorAB, courseB],
  ]) {
    await db.query(
      "insert into coordinator_assignments (user_id, course_id) values ($1, $2)",
      [user, course],
    );
  }
  for (const [user, company, owner] of [
    [owner1, company1, true],
    [member1, company1, false],
    [owner2, company2, true],
  ] as const) {
    await db.query(
      "insert into supervisor_memberships (user_id, company_id, is_owner) values ($1, $2, $3)",
      [user, company, owner],
    );
  }
  await insertStudent(courseA, batchA, studentUserA);
  await insertStudent(courseB, batchB, studentUserB);
});

afterAll(async () => {
  await db.close();
});

describe("invitations table", () => {
  it("no longer stores a token hash and keeps one Clerk invitation id per row", async () => {
    const columns = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_name = 'invitations'",
    );
    const names = columns.rows.map((r) => r.column_name);
    expect(names).not.toContain("token_hash");
    expect(names).toContain("clerk_invitation_id");
    expect(names).toContain("course_id");
  });

  it("requires the right target for each role", async () => {
    const student = await insertStudent(courseA, batchA, null);
    await expect(
      makeInvitation({ email: email(), role: "coordinator" }),
    ).rejects.toThrow(/check constraint/);
    await expect(
      makeInvitation({ email: email(), role: "coordinator", target: { course: courseA } }),
    ).resolves.toBeTruthy();
    await expect(
      makeInvitation({ email: email(), role: "student", target: { student, course: courseA } }),
    ).rejects.toThrow(/check constraint/);
    await expect(
      makeInvitation({ email: email(), role: "admin", target: { course: courseA } }),
    ).rejects.toThrow(/check constraint/);
    await expect(makeInvitation({ email: email(), role: "admin" })).resolves.toBeTruthy();
  });

  it("allows only one pending invitation per email, regardless of case", async () => {
    const to = email();
    await makeInvitation({ email: to, role: "admin" });
    await expect(
      makeInvitation({ email: to.toUpperCase(), role: "admin" }),
    ).rejects.toThrow(/duplicate key/);
    await makeInvitation({ email: email(), role: "admin", status: "revoked" });
  });

  it("stores the consent notice version in school settings", async () => {
    const row = await db.query<{ consent_notice_version: string }>(
      "select consent_notice_version from school_settings",
    );
    expect(row.rows[0].consent_notice_version).toBe("v1");
  });
});

describe("create_invitation", () => {
  it("lets an admin invite every role", async () => {
    const student = await insertStudent(courseA, batchA, null);
    await createInvitation(admin, "admin", email());
    await createInvitation(admin, "coordinator", email(), { course: courseA });
    await createInvitation(admin, "supervisor", email(), { company: company1 });
    await createInvitation(admin, "student", email(), { student });
  });

  it("stores the email lowercased, pending, expiring in the requested days", async () => {
    const created = await createInvitation(admin, "admin", `  Mixed.Case${counter}@Example.test `, {}, 7);
    const row = await db.query<{ email: string; status: string; days: number }>(
      `select email, status::text, round(extract(epoch from (expires_at - now())) / 86400)::int as days
       from invitations where id = $1`,
      [created.rows[0].id],
    );
    expect(row.rows[0].email).toBe(row.rows[0].email.toLowerCase());
    expect(row.rows[0].status).toBe("pending");
    expect(row.rows[0].days).toBe(7);
  });

  it("lets a company owner invite supervisors to their own company only", async () => {
    await expect(
      createInvitation(owner1, "supervisor", email(), { company: company1 }),
    ).resolves.toBeTruthy();
    await expect(
      createInvitation(owner1, "supervisor", email(), { company: company2 }),
    ).rejects.toThrow(/forbidden/);
    await expect(
      createInvitation(owner1, "admin", email()),
    ).rejects.toThrow(/forbidden/);
  });

  it("refuses a supervisor who is not the owner", async () => {
    await expect(
      createInvitation(member1, "supervisor", email(), { company: company1 }),
    ).rejects.toThrow(/forbidden/);
  });

  it("lets a coordinator invite students of their own courses only", async () => {
    const own = await insertStudent(courseA, batchA, null);
    const other = await insertStudent(courseB, batchB, null);
    await expect(
      createInvitation(coordinatorA, "student", email(), { student: own }),
    ).resolves.toBeTruthy();
    await expect(
      createInvitation(coordinatorA, "student", email(), { student: other }),
    ).rejects.toThrow(/forbidden/);
    await expect(
      createInvitation(coordinatorA, "supervisor", email(), { company: company1 }),
    ).rejects.toThrow(/forbidden/);
  });

  it("refuses a student, an inactive user, and an unknown actor", async () => {
    await expect(createInvitation(studentUserA, "admin", email())).rejects.toThrow(/forbidden/);
    const inactive = await insertUser("admin");
    await db.query("update users set is_active = false where id = $1", [inactive]);
    await expect(createInvitation(inactive, "admin", email())).rejects.toThrow(/forbidden/);
    await expect(
      createInvitation("00000000-0000-4000-8000-0000000000ff", "admin", email()),
    ).rejects.toThrow(/forbidden/);
  });

  it("refuses a student who already has an account", async () => {
    const linked = await insertStudent(courseA, batchA, await insertUser("student"));
    await expect(
      createInvitation(admin, "student", email(), { student: linked }),
    ).rejects.toThrow(/conflict/);
  });

  it("refuses an invalid target, expiry, email, or inactive company", async () => {
    await expect(createInvitation(admin, "student", email())).rejects.toThrow(/invalid/);
    await expect(createInvitation(admin, "admin", email(), {}, 0)).rejects.toThrow(/invalid/);
    await expect(createInvitation(admin, "admin", email(), {}, 31)).rejects.toThrow(/invalid/);
    await expect(createInvitation(admin, "admin", "   ")).rejects.toThrow(/invalid/);
    const inactive = await id(
      "insert into companies (name, status) values ('Dormant Co', 'inactive') returning id",
    );
    await expect(
      createInvitation(admin, "supervisor", email(), { company: inactive }),
    ).rejects.toThrow(/invalid/);
  });

  it("refuses a second pending invitation for the same email", async () => {
    const to = email();
    await createInvitation(admin, "admin", to);
    await expect(createInvitation(admin, "admin", to)).rejects.toThrow(/conflict/);
  });
});

describe("set_invitation_clerk_id and revoke_invitation", () => {
  it("lets the sender or an admin attach a Clerk invitation id once", async () => {
    const created = await createInvitation(owner1, "supervisor", email(), {
      company: company1,
    });
    const invitation = created.rows[0].id;
    await expect(
      db.query("select set_invitation_clerk_id($1::uuid, $2::uuid, 'inv_other')", [
        owner2,
        invitation,
      ]),
    ).rejects.toThrow(/forbidden/);
    await db.query("select set_invitation_clerk_id($1::uuid, $2::uuid, $3)", [
      owner1,
      invitation,
      `inv_${counter}`,
    ]);
    await expect(
      db.query("select set_invitation_clerk_id($1::uuid, $2::uuid, 'inv_again')", [
        admin,
        invitation,
      ]),
    ).rejects.toThrow(/conflict/);
  });

  it("lets the sender or an admin revoke a pending invitation, and nothing else", async () => {
    const created = await createInvitation(owner1, "supervisor", email(), {
      company: company1,
    });
    const invitation = created.rows[0].id;
    await expect(
      db.query("select revoke_invitation($1::uuid, $2::uuid)", [owner2, invitation]),
    ).rejects.toThrow(/forbidden/);
    await db.query("select revoke_invitation($1::uuid, $2::uuid)", [owner1, invitation]);
    await expect(
      db.query("select revoke_invitation($1::uuid, $2::uuid)", [admin, invitation]),
    ).rejects.toThrow(/conflict/);
  });
});

describe("accept_invitation", () => {
  it("creates a student user and links the roster record", async () => {
    const student = await insertStudent(courseA, batchA, null);
    const to = email();
    const invitation = await makeInvitation({ email: to, role: "student", target: { student } });
    const clerkId = newClerkId();
    const accepted = await acceptInvitation(clerkId, to, "Ana Sample", invitation);

    const user = await db.query<{ role: string; email: string; full_name: string }>(
      "select role::text, email, full_name from users where id = $1",
      [accepted.rows[0].id],
    );
    expect(user.rows[0]).toEqual({ role: "student", email: to, full_name: "Ana Sample" });
    const linked = await db.query<{ user_id: string }>(
      "select user_id from students where id = $1",
      [student],
    );
    expect(linked.rows[0].user_id).toBe(accepted.rows[0].id);
    const status = await db.query<{ status: string; used: boolean }>(
      "select status::text, used_at is not null as used from invitations where id = $1",
      [invitation],
    );
    expect(status.rows[0]).toEqual({ status: "used", used: true });
  });

  it("makes the first supervisor of a company its owner and the second a member", async () => {
    const company = await id("insert into companies (name) values ('Fresh Co') returning id");
    const firstEmail = email();
    const first = await acceptInvitation(
      newClerkId(),
      firstEmail,
      "First",
      await makeInvitation({ email: firstEmail, role: "supervisor", target: { company } }),
    );
    const secondEmail = email();
    const second = await acceptInvitation(
      newClerkId(),
      secondEmail,
      "Second",
      await makeInvitation({ email: secondEmail, role: "supervisor", target: { company } }),
    );
    const rows = await db.query<{ user_id: string; is_owner: boolean }>(
      "select user_id, is_owner from supervisor_memberships where company_id = $1",
      [company],
    );
    const owners = Object.fromEntries(rows.rows.map((r) => [r.user_id, r.is_owner]));
    expect(owners[first.rows[0].id]).toBe(true);
    expect(owners[second.rows[0].id]).toBe(false);
  });

  it("assigns a coordinator to the invited course", async () => {
    const to = email();
    const accepted = await acceptInvitation(
      newClerkId(),
      to,
      "Coordinator",
      await makeInvitation({ email: to, role: "coordinator", target: { course: courseB } }),
    );
    const rows = await db.query<{ course_id: string }>(
      "select course_id from coordinator_assignments where user_id = $1",
      [accepted.rows[0].id],
    );
    expect(rows.rows).toEqual([{ course_id: courseB }]);
  });

  it("creates an admin with no links", async () => {
    const to = email();
    const accepted = await acceptInvitation(
      newClerkId(),
      to,
      "Dev",
      await makeInvitation({ email: to, role: "admin" }),
    );
    const role = await db.query<{ role: string }>(
      "select role::text from users where id = $1",
      [accepted.rows[0].id],
    );
    expect(role.rows[0].role).toBe("admin");
  });

  it("matches the email regardless of case and falls back to the email when the name is blank", async () => {
    const to = email();
    const accepted = await acceptInvitation(
      newClerkId(),
      to.toUpperCase(),
      "   ",
      await makeInvitation({ email: to, role: "admin" }),
    );
    const row = await db.query<{ full_name: string }>(
      "select full_name from users where id = $1",
      [accepted.rows[0].id],
    );
    expect(row.rows[0].full_name).toBe(to);
  });

  it("refuses an invitation sent to a different email, and creates nothing", async () => {
    const invitation = await makeInvitation({ email: email(), role: "admin" });
    const clerkId = newClerkId();
    await expect(
      acceptInvitation(clerkId, "someone.else@example.test", "Intruder", invitation),
    ).rejects.toThrow(/forbidden/);
    expect(await usersWithClerkId(clerkId)).toBe(0);
  });

  it.each(["used", "revoked", "expired"])("refuses a %s invitation", async (status) => {
    const to = email();
    const invitation = await makeInvitation({ email: to, role: "admin", status });
    await expect(acceptInvitation(newClerkId(), to, "Name", invitation)).rejects.toThrow(
      /conflict/,
    );
  });

  it("refuses a pending invitation that has passed its expiry time", async () => {
    const to = email();
    const invitation = await makeInvitation({ email: to, role: "admin", minutes: -5 });
    const clerkId = newClerkId();
    await expect(acceptInvitation(clerkId, to, "Name", invitation)).rejects.toThrow(
      /expired/,
    );
    expect(await usersWithClerkId(clerkId)).toBe(0);
  });

  it("refuses an unknown invitation", async () => {
    await expect(
      acceptInvitation(
        newClerkId(),
        email(),
        "Name",
        "00000000-0000-4000-8000-0000000000ee",
      ),
    ).rejects.toThrow(/not_found/);
  });

  it("returns the existing user when called again for the same Clerk id", async () => {
    const to = email();
    const invitation = await makeInvitation({ email: to, role: "admin" });
    const clerkId = newClerkId();
    const first = await acceptInvitation(clerkId, to, "Same Person", invitation);
    const second = await acceptInvitation(clerkId, to, "Same Person", invitation);
    expect(second.rows[0].id).toBe(first.rows[0].id);
    expect(await usersWithClerkId(clerkId)).toBe(1);
  });

  it("changes nothing when it fails part-way (student already linked)", async () => {
    const linkedUser = await insertUser("student");
    const student = await insertStudent(courseA, batchA, linkedUser);
    const to = email();
    const invitation = await makeInvitation({ email: to, role: "student", target: { student } });
    const clerkId = newClerkId();
    await expect(acceptInvitation(clerkId, to, "Late", invitation)).rejects.toThrow(
      /conflict/,
    );
    expect(await usersWithClerkId(clerkId)).toBe(0);
    const status = await db.query<{ status: string }>(
      "select status::text from invitations where id = $1",
      [invitation],
    );
    expect(status.rows[0].status).toBe("pending");
  });

  it("refuses when an account with the email already exists", async () => {
    const to = email();
    await db.query(
      "insert into users (clerk_id, email, full_name, role) values ($1, $2, 'Existing', 'admin')",
      [newClerkId(), to],
    );
    const invitation = await makeInvitation({ email: to, role: "admin" });
    await expect(acceptInvitation(newClerkId(), to, "Name", invitation)).rejects.toThrow(
      /conflict/,
    );
  });

  it("refuses a supervisor invitation for a company that became inactive", async () => {
    const company = await id(
      "insert into companies (name, status) values ('Closed Co', 'active') returning id",
    );
    const to = email();
    const invitation = await makeInvitation({ email: to, role: "supervisor", target: { company } });
    await db.query("update companies set status = 'inactive' where id = $1", [company]);
    const clerkId = newClerkId();
    await expect(acceptInvitation(clerkId, to, "Name", invitation)).rejects.toThrow(
      /conflict/,
    );
    expect(await usersWithClerkId(clerkId)).toBe(0);
  });
});

describe("record_consent", () => {
  it("records the current notice version once per user", async () => {
    const user = await insertUser("student");
    await db.query("select record_consent($1::uuid, 'v1')", [user]);
    await db.query("select record_consent($1::uuid, 'v1')", [user]);
    const rows = await db.query("select 1 from consents where user_id = $1", [user]);
    expect(rows.rows).toHaveLength(1);
  });

  it("refuses an out-of-date notice version and an inactive user", async () => {
    const user = await insertUser("student");
    await expect(
      db.query("select record_consent($1::uuid, 'v0')", [user]),
    ).rejects.toThrow(/conflict/);
    await db.query("update users set is_active = false where id = $1", [user]);
    await expect(
      db.query("select record_consent($1::uuid, 'v1')", [user]),
    ).rejects.toThrow(/forbidden/);
  });

  it("asks for consent again when the notice version changes", async () => {
    const user = await insertUser("student");
    await db.query("select record_consent($1::uuid, 'v1')", [user]);
    await db.query("update school_settings set consent_notice_version = 'v2'");
    await db.query("select record_consent($1::uuid, 'v2')", [user]);
    const versions = await db.query<{ notice_version: string }>(
      "select notice_version from consents where user_id = $1 order by notice_version",
      [user],
    );
    expect(versions.rows.map((r) => r.notice_version)).toEqual(["v1", "v2"]);
    await db.query("update school_settings set consent_notice_version = 'v1'");
  });
});

describe("set_user_active", () => {
  const setActive = (actor: string, user: string, active: boolean) =>
    db.query("select set_user_active($1::uuid, $2::uuid, $3::boolean)", [
      actor,
      user,
      active,
    ]);
  const isActive = async (user: string) =>
    (await db.query<{ is_active: boolean }>("select is_active from users where id = $1", [user]))
      .rows[0].is_active;

  it("lets an admin deactivate and reactivate any user", async () => {
    const user = await insertUser("student");
    await setActive(admin, user, false);
    expect(await isActive(user)).toBe(false);
    await setActive(admin, user, true);
    expect(await isActive(user)).toBe(true);
  });

  it("lets a company owner change supervisors of their own company only", async () => {
    await setActive(owner1, member1, false);
    expect(await isActive(member1)).toBe(false);
    await setActive(owner1, member1, true);
    await expect(setActive(owner1, owner2, false)).rejects.toThrow(/forbidden/);
    await expect(setActive(owner1, studentUserA, false)).rejects.toThrow(/forbidden/);
    await expect(setActive(member1, owner1, false)).rejects.toThrow(/forbidden/);
  });

  it("lets a coordinator change students of their own courses only", async () => {
    await setActive(coordinatorA, studentUserA, false);
    expect(await isActive(studentUserA)).toBe(false);
    await setActive(coordinatorA, studentUserA, true);
    await expect(setActive(coordinatorA, studentUserB, false)).rejects.toThrow(/forbidden/);
    await expect(setActive(coordinatorA, owner1, false)).rejects.toThrow(/forbidden/);
  });

  it("refuses a student, changing yourself, and an unknown user", async () => {
    await expect(setActive(studentUserA, studentUserB, false)).rejects.toThrow(/forbidden/);
    await expect(setActive(admin, admin, false)).rejects.toThrow(/forbidden/);
    await expect(
      setActive(admin, "00000000-0000-4000-8000-0000000000dd", false),
    ).rejects.toThrow(/not_found/);
  });

  it("refuses an inactive actor, so a deactivated admin cannot change accounts", async () => {
    const second = await insertUser("admin");
    await setActive(admin, second, false);
    await expect(setActive(second, studentUserA, false)).rejects.toThrow(/forbidden/);
    await setActive(admin, second, true);
  });
});

describe("resolve_session", () => {
  async function resolve(clerkId: string) {
    return db.query<{
      user_id: string;
      role: string;
      is_active: boolean;
      student_id: string | null;
      course_ids: string[];
      company_id: string | null;
      is_company_owner: boolean;
      has_consent: boolean;
    }>("select * from resolve_session($1)", [clerkId]);
  }
  async function clerkOf(user: string) {
    return (await db.query<{ clerk_id: string }>("select clerk_id from users where id = $1", [user]))
      .rows[0].clerk_id;
  }

  it("returns nothing for an unknown Clerk id", async () => {
    expect((await resolve("nobody")).rows).toHaveLength(0);
  });

  it("returns the student's own record and course", async () => {
    const row = (await resolve(await clerkOf(studentUserA))).rows[0];
    expect(row.role).toBe("student");
    expect(row.student_id).toBeTruthy();
    expect(row.course_ids).toEqual([courseA]);
    expect(row.company_id).toBeNull();
  });

  it("returns every course of a coordinator", async () => {
    const row = (await resolve(await clerkOf(coordinatorAB))).rows[0];
    expect(row.role).toBe("coordinator");
    expect([...row.course_ids].sort()).toEqual([courseA, courseB].sort());
  });

  it("returns the company of a supervisor and whether they own it", async () => {
    const owner = (await resolve(await clerkOf(owner1))).rows[0];
    expect(owner).toMatchObject({ role: "supervisor", company_id: company1, is_company_owner: true });
    const member = (await resolve(await clerkOf(member1))).rows[0];
    expect(member).toMatchObject({ company_id: company1, is_company_owner: false });
  });

  it("reports whether the current privacy notice was accepted", async () => {
    const user = await insertUser("student");
    const clerkId = await clerkOf(user);
    expect((await resolve(clerkId)).rows[0].has_consent).toBe(false);
    await db.query("select record_consent($1::uuid, 'v1')", [user]);
    expect((await resolve(clerkId)).rows[0].has_consent).toBe(true);
    await db.query("update school_settings set consent_notice_version = 'v9'");
    expect((await resolve(clerkId)).rows[0].has_consent).toBe(false);
    await db.query("update school_settings set consent_notice_version = 'v1'");
  });

  it("returns an admin with no scope, and reports inactive users", async () => {
    const row = (await resolve(await clerkOf(admin))).rows[0];
    expect(row).toMatchObject({ role: "admin", course_ids: [], company_id: null, student_id: null });
    const user = await insertUser("student");
    await db.query("update users set is_active = false where id = $1", [user]);
    expect((await resolve(await clerkOf(user))).rows[0].is_active).toBe(false);
  });
});

describe("function privileges", () => {
  it.each(["anon", "authenticated"] as const)(
    "blocks %s from calling the write and session functions",
    async (role) => {
      await expect(
        asRole(db, role, () => db.query("select * from resolve_session('x')")),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asRole(db, role, () =>
          db.query("select record_consent('00000000-0000-4000-8000-000000000001'::uuid, 'v1')"),
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asRole(db, role, () =>
          db.query("select accept_invitation('x', 'x@example.test', 'x', '00000000-0000-4000-8000-000000000001'::uuid)"),
        ),
      ).rejects.toThrow(/permission denied/);
    },
  );

  it("lets the service role call them", async () => {
    const result = await asRole(db, "service_role", () =>
      db.query("select * from resolve_session('nobody')"),
    );
    expect(result.rows).toHaveLength(0);
  });
});
