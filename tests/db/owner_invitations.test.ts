import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./harness";

// Migration 23: a company owner invites colleague supervisors and manages their
// company's pending invitations. An email with an account is refused, an owner
// may have at most 10 live pending invitations, and the owner may revoke any
// pending supervisor invitation to their own company (ticket-33).

let db: Db;
let counter = 0;

let admin: string;
let owner1: string;
let member1: string;
let owner2: string;
let company1: string;
let company2: string;

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

function email() {
  counter += 1;
  return `colleague${counter}@example.test`;
}

function invite(actor: string, to: string, company: string) {
  return id(
    "select create_invitation($1::uuid, 'supervisor'::user_role, $2, null, $3::uuid) as id",
    [actor, to, company],
  );
}

function revoke(actor: string, invitation: string) {
  return db.query("select revoke_invitation($1::uuid, $2::uuid)", [actor, invitation]);
}

async function statusOf(invitation: string) {
  const row = await db.query<{ status: string }>(
    "select status::text from invitations where id = $1",
    [invitation],
  );
  return row.rows[0].status;
}

async function pendingCount(company: string) {
  const row = await db.query<{ n: number }>(
    "select count(*)::int as n from invitations where company_id = $1 and status = 'pending' and expires_at > now()",
    [company],
  );
  return row.rows[0].n;
}

beforeAll(async () => {
  db = await createDb();
  admin = await insertUser("admin");
  owner1 = await insertUser("supervisor");
  member1 = await insertUser("supervisor");
  owner2 = await insertUser("supervisor");
  company1 = await id("select create_company($1, 'Northwind') as id", [admin]);
  company2 = await id("select create_company($1, 'Bluepeak') as id", [admin]);
  const member = "insert into supervisor_memberships (user_id, company_id, is_owner) values ($1, $2, $3)";
  await db.query(member, [owner1, company1, true]);
  await db.query(member, [member1, company1, false]);
  await db.query(member, [owner2, company2, true]);
});

afterAll(async () => {
  await db.close();
});

describe("an owner invites a colleague", () => {
  it("creates a membership of the same company, not an owner, and audits it", async () => {
    const to = email();
    const invitation = await invite(owner1, to, company1);
    const user = await id("select accept_invitation('clerk-new-colleague', $1, 'New Colleague', $2) as id", [
      to,
      invitation,
    ]);

    const membership = await db.query<{ company_id: string; is_owner: boolean }>(
      "select company_id, is_owner from supervisor_memberships where user_id = $1",
      [user],
    );
    expect(membership.rows).toEqual([{ company_id: company1, is_owner: false }]);

    const audit = await db.query<{ action: string; actor_id: string; new_value: Record<string, unknown> }>(
      "select action, actor_id, new_value from audit_log where table_name = 'supervisor_memberships' and new_value->>'user_id' = $1",
      [user],
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]).toMatchObject({ action: "insert", actor_id: user });
    expect(audit.rows[0].new_value).toMatchObject({ company_id: company1, is_owner: false });
    expect(await statusOf(invitation)).toBe("used");
  });

  it("refuses a colleague who is not the owner, and another company", async () => {
    await expect(invite(member1, email(), company1)).rejects.toThrow(/forbidden/);
    await expect(invite(owner1, email(), company2)).rejects.toThrow(/forbidden/);
  });
});

describe("an email that already has an account", () => {
  it("is refused for a supervisor invitation, from an owner or an admin, ignoring case", async () => {
    const existing = await insertUser("student");
    const address = (
      await db.query<{ email: string }>("select email from users where id = $1", [existing])
    ).rows[0].email;
    await expect(invite(owner1, address.toUpperCase(), company1)).rejects.toThrow(
      /conflict: this email already has a Dugtong account/,
    );
    await expect(invite(admin, address, company1)).rejects.toThrow(/conflict/);
  });

  it("still lets an admin invite other roles as before", async () => {
    await expect(
      db.query("select create_invitation($1::uuid, 'admin'::user_role, $2)", [admin, email()]),
    ).resolves.toBeDefined();
  });
});

describe("at most 10 live pending invitations per company for an owner", () => {
  it("refuses the eleventh, counts only live ones, and does not limit the admin", async () => {
    const company = await id("select create_company($1, 'Capped Co') as id", [admin]);
    const owner = await insertUser("supervisor");
    await db.query(
      "insert into supervisor_memberships (user_id, company_id, is_owner) values ($1, $2, true)",
      [owner, company],
    );

    const sent: string[] = [];
    for (let i = 0; i < 10; i += 1) sent.push(await invite(owner, email(), company));
    expect(await pendingCount(company)).toBe(10);
    await expect(invite(owner, email(), company)).rejects.toThrow(
      /conflict: this company already has 10 pending invitations/,
    );

    // an expired one no longer counts
    await db.query("update invitations set expires_at = now() - interval '1 minute' where id = $1", [
      sent[0],
    ]);
    await expect(invite(owner, email(), company)).resolves.toBeTruthy();

    // a revoked one frees a place too
    await revoke(owner, sent[1]);
    await expect(invite(owner, email(), company)).resolves.toBeTruthy();

    await expect(invite(admin, email(), company)).resolves.toBeTruthy();
  });
});

describe("revoke_invitation by the owner", () => {
  it("lets the owner revoke an invitation the admin sent to their company", async () => {
    const invitation = await invite(admin, email(), company1);
    await revoke(owner1, invitation);
    expect(await statusOf(invitation)).toBe("revoked");
  });

  it("refuses a colleague who is not the owner", async () => {
    const invitation = await invite(admin, email(), company1);
    await expect(revoke(member1, invitation)).rejects.toThrow(/forbidden/);
    expect(await statusOf(invitation)).toBe("pending");
  });

  it("refuses the owner of another company", async () => {
    const invitation = await invite(admin, email(), company1);
    await expect(revoke(owner2, invitation)).rejects.toThrow(/forbidden/);
    expect(await statusOf(invitation)).toBe("pending");
  });

  it("does not let an owner revoke an invitation of another role", async () => {
    const invitation = await id(
      "select create_invitation($1::uuid, 'admin'::user_role, $2) as id",
      [admin, email()],
    );
    await expect(revoke(owner1, invitation)).rejects.toThrow(/forbidden/);
  });

  it("refuses an invitation that is no longer pending", async () => {
    const invitation = await invite(owner1, email(), company1);
    await revoke(owner1, invitation);
    await expect(revoke(owner1, invitation)).rejects.toThrow(/conflict/);
  });

  it("audits the revoke with the owner as the actor", async () => {
    const invitation = await invite(admin, email(), company1);
    await revoke(owner1, invitation);
    const audit = await db.query<{ actor_id: string; new_value: Record<string, unknown> }>(
      "select actor_id, new_value from audit_log where table_name = 'invitations' and row_id = $1 and action = 'update' order by id desc limit 1",
      [invitation],
    );
    expect(audit.rows[0]).toMatchObject({ actor_id: owner1, new_value: { status: "revoked" } });
  });
});
