import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const migrationsDir = join(process.cwd(), "supabase", "migrations");

// What hosted Supabase provides that plain Postgres does not: the API roles,
// default table privileges for them, and auth.jwt().
const supabaseStubs = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on tables to anon, authenticated, service_role;
  create schema auth;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
`;

export type Db = PGlite;

// A fresh in-memory Postgres with every migration applied in order.
export async function createDb(): Promise<Db> {
  const db = new PGlite();
  await db.exec(supabaseStubs);
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }
  return db;
}

// Runs fn as an API role (anon, authenticated) or the service role.
export async function asRole<T>(
  db: Db,
  role: "anon" | "authenticated" | "service_role",
  fn: () => Promise<T>,
): Promise<T> {
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

export async function count(db: Db, table: string): Promise<number> {
  const result = await db.query<{ n: number }>(
    `select count(*)::int as n from ${table}`,
  );
  return result.rows[0].n;
}
