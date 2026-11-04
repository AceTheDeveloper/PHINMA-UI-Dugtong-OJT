import "server-only";
import { z } from "zod";
import { adminClient } from "@/lib/db/admin";
import type { ExportDeployment } from "@/lib/supervisor/export";
import { errorFromDatabase, fail, ok, type Result } from "@/lib/result";

// The read behind the supervisor's CSV (ticket-34). It uses the service role, so
// the caller has already run authorize(["supervisor"]) and passes the company
// from the session, never one from the browser. Hours come from the same
// deployment_hours view as the students page, so the file matches the screen.
// The API returns at most 1000 rows a request, so each read pages through.

const unexpected = "Something went wrong. Try again in a moment.";
const db = () => adminClient();
const pageSize = 1000;

type Page = PromiseLike<{ data: unknown; error: { message: string } | null }>;

// Reads every page of a query, ordered by the caller so pages never overlap.
async function readAll<S extends z.ZodType>(
  schema: S,
  page: (from: number, to: number) => Page,
): Promise<Result<z.infer<S>[]>> {
  const rows: z.infer<S>[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) return { ok: false, error: errorFromDatabase(error.message) };
    const parsed = z.array(schema).safeParse(data);
    if (!parsed.success) return fail("unexpected", unexpected);
    rows.push(...parsed.data);
    if (parsed.data.length < pageSize) return ok(rows);
  }
}

// PostgREST returns a to-one embed as an object; accept a one-item array too.
function one<T extends z.ZodType>(schema: T) {
  return z.union([schema, z.array(schema).length(1).transform((items) => items[0])]);
}

const deploymentRow = z.object({
  id: z.string(),
  status: z.enum(["active", "completed", "ended"]),
  created_at: z.string(),
  student: one(
    z.object({
      full_name: z.string(),
      student_number: z.string(),
      course: one(z.object({ code: z.string() })),
    }),
  ),
  batch: one(z.object({ required_hours: z.coerce.number() })),
});
const hoursRow = z.object({ deployment_id: z.string(), approved_hours: z.coerce.number() });
const activityRow = z.object({
  deployment_id: z.string(),
  last_entry_date: z.string().nullable(),
  pending_entries: z.number(),
});

export type CompanyExport = { companyName: string; rows: ExportDeployment[] };

// Every deployment at the company. Null when the company does not exist.
export async function getCompanyExport(companyId: string): Promise<Result<CompanyExport | null>> {
  const company = await db().from("companies").select("name").eq("id", companyId);
  if (company.error) return { ok: false, error: errorFromDatabase(company.error.message) };
  const named = z.array(z.object({ name: z.string() })).safeParse(company.data);
  if (!named.success) return fail("unexpected", unexpected);
  if (named.data.length === 0) return ok(null);

  const deployments = await readAll(deploymentRow, (from, to) =>
    db()
      .from("deployments")
      .select(
        "id, status, created_at, student:students(full_name, student_number, course:courses(code)), batch:ojt_batches(required_hours)",
      )
      .eq("company_id", companyId)
      .order("id")
      .range(from, to),
  );
  if (!deployments.ok) return deployments;
  const hours = await readAll(hoursRow, (from, to) =>
    db()
      .from("deployment_hours")
      .select("deployment_id, approved_hours")
      .eq("company_id", companyId)
      .order("deployment_id")
      .range(from, to),
  );
  if (!hours.ok) return hours;
  const activity = await readAll(activityRow, (from, to) =>
    db()
      .from("deployment_activity")
      .select("deployment_id, last_entry_date, pending_entries")
      .eq("company_id", companyId)
      .order("deployment_id")
      .range(from, to),
  );
  if (!activity.ok) return activity;

  const hoursOf = new Map(hours.data.map((row) => [row.deployment_id, row.approved_hours]));
  const activityOf = new Map(activity.data.map((row) => [row.deployment_id, row]));
  return ok({
    companyName: named.data[0].name,
    rows: deployments.data.map((row) => ({
      studentName: row.student.full_name,
      studentNumber: row.student.student_number,
      courseCode: row.student.course.code,
      status: row.status,
      startedAt: row.created_at,
      approvedHours: hoursOf.get(row.id) ?? 0,
      requiredHours: row.batch.required_hours,
      pendingEntries: activityOf.get(row.id)?.pending_entries ?? 0,
      lastEntryDate: activityOf.get(row.id)?.last_entry_date ?? null,
    })),
  });
}
