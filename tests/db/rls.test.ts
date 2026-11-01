import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asRole, count, createDb, type Db } from "./harness";

let db: Db;
let tables: string[];

beforeAll(async () => {
  db = await createDb();
  // A few rows so "reads nothing" means something.
  await db.exec(`
    insert into departments (id, code, name)
      values ('00000000-0000-4000-8000-000000000001', 'D', 'Dept');
    insert into courses (id, department_id, code, name)
      values ('00000000-0000-4000-8000-000000000002',
              '00000000-0000-4000-8000-000000000001', 'C', 'Course');
    insert into companies (name) values ('Visible Co');
  `);
  const result = await db.query<{ relname: string }>(`
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  `);
  tables = result.rows.map((r) => r.relname);
});

afterAll(async () => {
  await db.close();
});

describe("row level security", () => {
  it("is enabled on every table", async () => {
    expect(tables.length).toBeGreaterThan(0);
    const result = await db.query<{ relname: string }>(`
      select c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
    `);
    expect(result.rows).toEqual([]);
  });

  it.each(["anon", "authenticated"] as const)(
    "lets %s read nothing from any table",
    async (role) => {
      for (const table of tables) {
        const seen = await asRole(db, role, () => count(db, table));
        expect(seen, `${role} saw rows in ${table}`).toBe(0);
      }
    },
  );

  it("shows the seeded rows to the service role", async () => {
    const seen = await asRole(db, "service_role", () => count(db, "companies"));
    expect(seen).toBe(1);
  });

  it.each(["anon", "authenticated"] as const)(
    "blocks %s from writing",
    async (role) => {
      await expect(
        asRole(db, role, () =>
          db.query("insert into companies (name) values ('Sneaky Co')"),
        ),
      ).rejects.toThrow(/row-level security/);
      await expect(
        asRole(db, role, () =>
          db.query("insert into departments (code, name) values ('X', 'X')"),
        ),
      ).rejects.toThrow(/row-level security/);
    },
  );

  it("lets a user session change or delete nothing", async () => {
    await asRole(db, "authenticated", () =>
      db.query("update companies set name = 'Renamed'"),
    );
    await asRole(db, "authenticated", () => db.query("delete from companies"));
    const row = await db.query<{ name: string }>("select name from companies");
    expect(row.rows).toEqual([{ name: "Visible Co" }]);
  });

  it("keeps the listings_without_courses view off the API", async () => {
    await expect(
      asRole(db, "authenticated", () =>
        db.query("select * from listings_without_courses"),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("migrations", () => {
  it("contain no CITE or BSIT value (those are seed data)", () => {
    const dir = join(process.cwd(), "supabase", "migrations");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
      const sql = readFileSync(join(dir, file), "utf8");
      expect(sql, file).not.toMatch(/\b(CITE|BSIT)\b/);
    }
  });
});

describe("seed.sql", () => {
  it("applies cleanly to a migrated database", async () => {
    const fresh = await createDb();
    try {
      await fresh.exec(
        readFileSync(join(process.cwd(), "supabase", "seed.sql"), "utf8"),
      );
      expect(await count(fresh, "ojt_batches")).toBe(1);
    } finally {
      await fresh.close();
    }
  });
});
