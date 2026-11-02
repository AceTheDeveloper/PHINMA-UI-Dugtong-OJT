import "server-only";
import { z } from "zod";
import { adminClient } from "@/lib/db/admin";
import type { AuditFilters } from "@/lib/coordinator/audit-filters";
import { sentenceFor, type AuditRowLike, type Sentence } from "@/lib/coordinator/audit-sentences";
import { errorFromDatabase, fail, ok, type Result } from "@/lib/result";

// Reads for the coordinator's Audit log. They use the service role, so the caller
// has already run requireRole(["coordinator"]) and passes the course ids from the
// session, never ids from the browser. A row is shown only when it can be tied to
// the coordinator's newest batch by a deployment, a student, or the batch itself;
// company, listing, and user-management changes stay in the admin log. The
// sentences never carry a journal, a comment, or a reason.

const unexpected = "Something went wrong. Try again in a moment.";
const db = () => adminClient();
const limit = 1000;
// How many of the newest rows are read from each group before they are put into
// sentences. Plenty for a pilot; a longer history is read by narrowing the dates.
const window = 500;

async function read<S extends z.ZodType>(
  schema: S,
  run: () => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<Result<z.infer<S>>> {
  const { data, error } = await run();
  if (error) return { ok: false, error: errorFromDatabase(error.message) };
  const parsed = schema.safeParse(data);
  return parsed.success ? ok(parsed.data) : fail("unexpected", unexpected);
}

function one<T extends z.ZodType>(schema: T) {
  return z.union([schema, z.array(schema).length(1).transform((items) => items[0])]);
}

const courseRow = z.object({ id: z.string(), code: z.string() });
const batchRow = z.object({ id: z.string(), school_year: z.string() });
const studentRow = z.object({ id: z.string(), full_name: z.string() });
const deploymentRow = z.object({
  id: z.string(),
  student_id: z.string(),
  company: one(z.object({ name: z.string() })),
});
const auditRow = z.object({
  id: z.number(),
  table_name: z.string(),
  row_id: z.string(),
  action: z.enum(["insert", "update", "delete"]),
  old_value: z.record(z.string(), z.unknown()).nullable(),
  new_value: z.record(z.string(), z.unknown()).nullable(),
  actor_id: z.string().nullable(),
  source: z.enum(["app", "database"]),
  created_at: z.string(),
});
const userRow = z.object({ id: z.string(), full_name: z.string() });

export type AuditItem = {
  id: number;
  at: string;
  text: string;
  kind: Sentence["kind"];
  studentId: string | null;
};

export type AuditView = {
  course: { courseShort: string; batchLabel: string };
  filters: AuditFilters;
  items: AuditItem[];
  // True when more changes match than are shown.
  more: boolean;
  students: { id: string; name: string }[];
};

// A date typed in a filter is a day in Manila, so it runs from midnight there.
const startOf = (date: string) => `${date}T00:00:00+08:00`;
function endOf(date: string) {
  const next = new Date(`${date}T00:00:00+08:00`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

export async function getAuditView(
  courseIds: readonly string[],
  filters: AuditFilters,
): Promise<Result<AuditView | null>> {
  if (courseIds.length === 0) return ok(null);

  const courses = await read(z.array(courseRow), () =>
    db().from("courses").select("id, code").in("id", [...courseIds]).order("code"),
  );
  if (!courses.ok) return courses;
  const course = courses.data[0];
  if (!course) return ok(null);
  const batches = await read(z.array(batchRow), () =>
    db()
      .from("ojt_batches")
      .select("id, school_year")
      .eq("course_id", course.id)
      .order("school_year", { ascending: false })
      .limit(1),
  );
  if (!batches.ok) return batches;
  const batch = batches.data[0];
  if (!batch) return ok(null);

  const students = await read(z.array(studentRow), () =>
    db()
      .from("students")
      .select("id, full_name")
      .eq("ojt_batch_id", batch.id)
      .order("full_name")
      .limit(limit),
  );
  if (!students.ok) return students;
  const deployments = await read(z.array(deploymentRow), () =>
    db()
      .from("deployments")
      .select("id, student_id, company:companies(name)")
      .eq("ojt_batch_id", batch.id)
      .limit(limit),
  );
  if (!deployments.ok) return deployments;

  const studentNames = new Map(students.data.map((row) => [row.id, row.full_name]));
  const deploymentMap = new Map(
    deployments.data.flatMap((row) => {
      const studentName = studentNames.get(row.student_id);
      return studentName
        ? [[row.id, { studentId: row.student_id, studentName, companyName: row.company.name }] as const]
        : [];
    }),
  );

  // Two groups so the many entry edits do not crowd out the rarer events.
  const range = <T extends { gte: (c: string, v: string) => T; lt: (c: string, v: string) => T }>(query: T): T => {
    let next = query;
    if (filters.from) next = next.gte("created_at", startOf(filters.from));
    if (filters.to) next = next.lt("created_at", endOf(filters.to));
    return next;
  };
  const entries = await read(z.array(auditRow), () =>
    range(
      db()
        .from("audit_log")
        .select("id, table_name, row_id, action, old_value, new_value, actor_id, source, created_at")
        .eq("table_name", "daily_logs")
        .in("action", ["insert", "update"]),
    )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(window),
  );
  if (!entries.ok) return entries;
  const others = await read(z.array(auditRow), () =>
    range(
      db()
        .from("audit_log")
        .select("id, table_name, row_id, action, old_value, new_value, actor_id, source, created_at")
        .in("table_name", ["evaluations", "certifications", "deployments", "ojt_batches", "students"]),
    )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(window),
  );
  if (!others.ok) return others;

  const rows = [...entries.data, ...others.data];
  const actorIds = [...new Set(rows.flatMap((row) => (row.actor_id ? [row.actor_id] : [])))];
  const actors =
    actorIds.length === 0
      ? ok([] as z.infer<typeof userRow>[])
      : await read(z.array(userRow), () =>
          db().from("users").select("id, full_name").in("id", actorIds).limit(limit),
        );
  if (!actors.ok) return actors;
  const actorNames = new Map(actors.data.map((row) => [row.id, row.full_name]));

  const items: AuditItem[] = [];
  for (const row of rows) {
    const sentence = sentenceFor(row as AuditRowLike, {
      batchId: batch.id,
      deployments: deploymentMap,
      students: studentNames,
      actorName: row.actor_id
        ? (actorNames.get(row.actor_id) ?? "Someone")
        : row.source === "database"
          ? "A change made directly in the database"
          : "Someone",
    });
    if (!sentence) continue;
    if (filters.kind !== "all" && sentence.kind !== filters.kind) continue;
    if (filters.student && sentence.studentId !== filters.student) continue;
    items.push({ id: row.id, at: row.created_at, text: sentence.text, kind: sentence.kind, studentId: sentence.studentId });
  }
  items.sort((a, b) => (a.at === b.at ? b.id - a.id : b.at.localeCompare(a.at)));

  return ok({
    course: { courseShort: course.code, batchLabel: batch.school_year },
    filters,
    items: items.slice(0, filters.shown),
    more: items.length > filters.shown,
    students: students.data.map((row) => ({ id: row.id, name: row.full_name })),
  });
}
