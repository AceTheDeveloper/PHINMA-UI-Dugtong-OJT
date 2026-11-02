import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./harness";

let db: Db;
let deptId: string;
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

async function course() {
  counter += 1;
  return id(
    "insert into courses (department_id, code, name) values ($1, $2, $3) returning id",
    [deptId, `C${counter}`, `Course ${counter}`],
  );
}

async function coordinatorOf(courseId: string) {
  const user = await insertUser("coordinator");
  await db.query("insert into coordinator_assignments (user_id, course_id) values ($1, $2)", [
    user,
    courseId,
  ]);
  return user;
}

async function setup() {
  const courseId = await course();
  return { courseId, coordinator: await coordinatorOf(courseId) };
}

const createDraft = (actor: string, courseId: string) =>
  id("select create_evaluation_draft($1, $2) as id", [actor, courseId]);
const save = (actor: string, form: string, criteria: string[] | null) =>
  db.query("select save_evaluation_draft($1, $2, $3::text[])", [actor, form, criteria]);
const publish = (actor: string, form: string) =>
  db.query("select publish_evaluation_form($1, $2)", [actor, form]);
const discard = (actor: string, form: string) =>
  db.query("select discard_evaluation_draft($1, $2)", [actor, form]);

async function criteria(form: string) {
  return (
    await db.query<{ label: string; position: number }>(
      "select label, position from evaluation_criteria where form_id = $1 order by position",
      [form],
    )
  ).rows.map((row) => row.label);
}

async function formRow(form: string) {
  return (
    await db.query<{
      status: string;
      version: number;
      published_by: string | null;
      published_at: string | null;
    }>("select status, version, published_by, published_at::text from evaluation_forms where id = $1", [
      form,
    ])
  ).rows[0];
}

// A published form with these criteria.
async function published(actor: string, courseId: string, labels = ["Punctuality", "Quality of work"]) {
  const form = await createDraft(actor, courseId);
  await save(actor, form, labels);
  await publish(actor, form);
  return form;
}

beforeAll(async () => {
  db = await createDb();
  deptId = await id(
    "insert into departments (code, name) values ('CITE', 'College of IT') returning id",
  );
});

afterAll(async () => {
  await db.close();
});

describe("who may change a form", () => {
  it.each(["student", "supervisor", "admin"])("refuses a %s", async (role) => {
    const { courseId, coordinator } = await setup();
    const form = await createDraft(coordinator, courseId);
    const actor = await insertUser(role);
    await expect(createDraft(actor, courseId)).rejects.toThrow(/forbidden/);
    await expect(save(actor, form, ["Punctuality"])).rejects.toThrow(/forbidden/);
    await expect(publish(actor, form)).rejects.toThrow(/forbidden/);
    await expect(discard(actor, form)).rejects.toThrow(/forbidden/);
    expect((await formRow(form)).status).toBe("draft");
  });

  it("refuses an inactive coordinator", async () => {
    const { courseId, coordinator } = await setup();
    await db.query("update users set is_active = false where id = $1", [coordinator]);
    await expect(createDraft(coordinator, courseId)).rejects.toThrow(/forbidden/);
  });

  it("refuses a coordinator of another course to start a form, and reports its form as not found", async () => {
    const mine = await setup();
    const other = await setup();
    await expect(createDraft(other.coordinator, mine.courseId)).rejects.toThrow(/forbidden/);
    const form = await createDraft(mine.coordinator, mine.courseId);
    await expect(save(other.coordinator, form, ["Sneaky"])).rejects.toThrow(/not_found/);
    await expect(publish(other.coordinator, form)).rejects.toThrow(/not_found/);
    await expect(discard(other.coordinator, form)).rejects.toThrow(/not_found/);
    expect(await criteria(form)).toEqual([]);
  });

  it("reports a form that does not exist as not found for a coordinator, forbidden for anyone else", async () => {
    const { coordinator } = await setup();
    const missing = "00000000-0000-4000-8000-0000000000ff";
    await expect(publish(coordinator, missing)).rejects.toThrow(/not_found/);
    await expect(publish(await insertUser("student"), missing)).rejects.toThrow(/forbidden/);
  });

  it("cannot be called by the API roles", async () => {
    const { courseId, coordinator } = await setup();
    await db.exec("set role authenticated");
    try {
      await expect(createDraft(coordinator, courseId)).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });
});

describe("drafts", () => {
  it("starts empty at version 1 for a new course", async () => {
    const { courseId, coordinator } = await setup();
    const form = await createDraft(coordinator, courseId);
    expect(await formRow(form)).toMatchObject({ status: "draft", version: 1 });
    expect(await criteria(form)).toEqual([]);
  });

  it("allows only one draft per course", async () => {
    const { courseId, coordinator } = await setup();
    await createDraft(coordinator, courseId);
    await expect(createDraft(coordinator, courseId)).rejects.toThrow(/already has a draft/);
  });

  it("saves criteria in order, trimmed, and replaces the earlier list", async () => {
    const { courseId, coordinator } = await setup();
    const form = await createDraft(coordinator, courseId);
    await save(coordinator, form, ["  Teamwork ", "Punctuality", "Initiative"]);
    expect(await criteria(form)).toEqual(["Teamwork", "Punctuality", "Initiative"]);
    await save(coordinator, form, ["Initiative", "Teamwork"]);
    expect(await criteria(form)).toEqual(["Initiative", "Teamwork"]);
    await save(coordinator, form, []);
    expect(await criteria(form)).toEqual([]);
  });

  it.each([
    ["an empty criterion", ["Teamwork", "   "], /cannot be empty/],
    ["a criterion over 200 characters", ["x".repeat(201)], /up to 200 characters/],
    ["duplicates ignoring case", ["Teamwork", "teamwork "], /same name/],
    ["more than 30 criteria", Array.from({ length: 31 }, (_, index) => `Criterion ${index}`), /up to 30/],
    ["no list", null, /up to 30/],
  ])("refuses %s and keeps the earlier list", async (_name, labels, message) => {
    const { courseId, coordinator } = await setup();
    const form = await createDraft(coordinator, courseId);
    await save(coordinator, form, ["Keep me"]);
    await expect(save(coordinator, form, labels)).rejects.toThrow(message);
    expect(await criteria(form)).toEqual(["Keep me"]);
  });

  it("can be discarded, and then a new draft can start", async () => {
    const { courseId, coordinator } = await setup();
    const form = await createDraft(coordinator, courseId);
    await save(coordinator, form, ["Teamwork"]);
    await discard(coordinator, form);
    expect((await db.query("select 1 from evaluation_forms where id = $1", [form])).rows).toHaveLength(0);
    expect((await db.query("select 1 from evaluation_criteria where form_id = $1", [form])).rows).toHaveLength(0);
    expect(await formRow(await createDraft(coordinator, courseId))).toMatchObject({ version: 1 });
  });
});

describe("publishing", () => {
  it("publishes a draft with criteria, recording who and when", async () => {
    const { courseId, coordinator } = await setup();
    const form = await published(coordinator, courseId);
    expect(await formRow(form)).toMatchObject({ status: "published", published_by: coordinator });
    expect((await formRow(form)).published_at).not.toBeNull();
  });

  it("refuses an empty draft and an unknown draft state", async () => {
    const { courseId, coordinator } = await setup();
    const form = await createDraft(coordinator, courseId);
    await expect(publish(coordinator, form)).rejects.toThrow(/add at least one criterion/);
    expect((await formRow(form)).status).toBe("draft");
  });

  it("refuses to publish, edit, or discard a form that is already published", async () => {
    const { courseId, coordinator } = await setup();
    const form = await published(coordinator, courseId);
    await expect(publish(coordinator, form)).rejects.toThrow(/only a draft can be published/);
    await expect(save(coordinator, form, ["Changed"])).rejects.toThrow(/only a draft can be edited/);
    await expect(discard(coordinator, form)).rejects.toThrow(/only a draft can be discarded/);
  });

  it("starts the next version as a copy, and publishing it archives the old one", async () => {
    const { courseId, coordinator } = await setup();
    const first = await published(coordinator, courseId, ["Punctuality", "Teamwork"]);
    const draft = await createDraft(coordinator, courseId);
    expect(await formRow(draft)).toMatchObject({ version: 2, status: "draft" });
    expect(await criteria(draft)).toEqual(["Punctuality", "Teamwork"]);

    await save(coordinator, draft, ["Punctuality", "Teamwork", "Initiative"]);
    await publish(coordinator, draft);
    expect((await formRow(first)).status).toBe("archived");
    expect((await formRow(draft)).status).toBe("published");
    expect(await criteria(first)).toEqual(["Punctuality", "Teamwork"]);
  });

  it("keeps courses apart", async () => {
    const a = await setup();
    const b = await setup();
    await published(a.coordinator, a.courseId);
    const formB = await published(b.coordinator, b.courseId, ["Other"]);
    expect((await formRow(formB)).version).toBe(1);
    expect(await criteria(formB)).toEqual(["Other"]);
  });
});

describe("a published form is locked", () => {
  it("rejects direct changes to its criteria", async () => {
    const { courseId, coordinator } = await setup();
    const form = await published(coordinator, courseId);
    await expect(
      db.query("update evaluation_criteria set label = 'Edited' where form_id = $1", [form]),
    ).rejects.toThrow(/cannot be changed/);
    await expect(
      db.query("delete from evaluation_criteria where form_id = $1", [form]),
    ).rejects.toThrow(/cannot be changed/);
    await expect(
      db.query("insert into evaluation_criteria (form_id, position, label) values ($1, 9, 'Extra')", [form]),
    ).rejects.toThrow(/cannot be changed/);
    expect(await criteria(form)).toEqual(["Punctuality", "Quality of work"]);
  });

  it("rejects direct changes and deletes of the form", async () => {
    const { courseId, coordinator } = await setup();
    const form = await published(coordinator, courseId);
    await expect(
      db.query("update evaluation_forms set version = 99 where id = $1", [form]),
    ).rejects.toThrow(/cannot be changed/);
    await expect(
      db.query("update evaluation_forms set status = 'draft' where id = $1", [form]),
    ).rejects.toThrow(/cannot be changed/);
    await expect(db.query("delete from evaluation_forms where id = $1", [form])).rejects.toThrow(
      /cannot be deleted/,
    );
  });

  it("locks an archived form too", async () => {
    const { courseId, coordinator } = await setup();
    const first = await published(coordinator, courseId);
    await published(coordinator, courseId, ["New"]);
    expect((await formRow(first)).status).toBe("archived");
    await expect(
      db.query("update evaluation_forms set status = 'published' where id = $1", [first]),
    ).rejects.toThrow(/archived form cannot be changed/);
    await expect(
      db.query("update evaluation_criteria set label = 'x' where form_id = $1", [first]),
    ).rejects.toThrow(/cannot be changed/);
  });
});

describe("audit", () => {
  it("records create, publish, and archive with the coordinator as the actor", async () => {
    const { courseId, coordinator } = await setup();
    const first = await published(coordinator, courseId);
    const second = await createDraft(coordinator, courseId);
    await save(coordinator, second, ["Teamwork"]);
    await publish(coordinator, second);

    const audit = await db.query<{ row_id: string; action: string; actor_id: string; new_value: Record<string, string> }>(
      "select row_id, action, actor_id, new_value from audit_log where table_name = 'evaluation_forms' and row_id in ($1, $2) order by id",
      [first, second],
    );
    expect(audit.rows.every((row) => row.actor_id === coordinator)).toBe(true);
    const statuses = audit.rows.map((row) => `${row.row_id === first ? "first" : "second"}:${row.action}:${row.new_value.status ?? ""}`);
    expect(statuses).toEqual(
      expect.arrayContaining(["first:insert:draft", "first:update:published", "second:insert:draft", "first:update:archived", "second:update:published"]),
    );
  });

  it("records a discarded draft", async () => {
    const { courseId, coordinator } = await setup();
    const form = await createDraft(coordinator, courseId);
    await discard(coordinator, form);
    const audit = await db.query<{ action: string }>(
      "select action from audit_log where table_name = 'evaluation_forms' and row_id = $1 order by id",
      [form],
    );
    expect(audit.rows.map((row) => row.action)).toEqual(["insert", "delete"]);
  });
});

describe("tables are closed to the API roles", () => {
  it("shows no rows (RLS on, no policies)", async () => {
    const { courseId, coordinator } = await setup();
    await published(coordinator, courseId);
    await db.exec("set role authenticated");
    try {
      expect((await db.query("select * from evaluation_forms")).rows).toHaveLength(0);
      expect((await db.query("select * from evaluation_criteria")).rows).toHaveLength(0);
    } finally {
      await db.exec("reset role");
    }
  });
});
