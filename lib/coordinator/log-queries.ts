import "server-only";
import { z } from "zod";
import { adminClient } from "@/lib/db/admin";
import { staleCutoff, type LogFilters, type LogStatusFilter } from "@/lib/coordinator/log-filters";
import type { LogCounts, LogRow, LogsView } from "@/lib/coordinator/log-types";
import { daysBetween } from "@/lib/coordinator/queries";
import { errorFromDatabase, fail, ok, type Result } from "@/lib/result";
import { manilaToday } from "@/lib/schedules/logic";

// Reads for the coordinator's Daily logs screen. They use the service role, so the
// caller has already run requireRole(["coordinator"]) and passes the course ids
// from the session, never ids from the browser. Every entry is read through its
// deployment's batch: an entry, student, or company id from the address that
// does not belong to the coordinator's batch simply matches nothing.

const unexpected = "Something went wrong. Try again in a moment.";
const db = () => adminClient();
const limit = 1000;

type Answer = { data: unknown; error: { message: string } | null; count?: number | null };

async function read<S extends z.ZodType>(
  schema: S,
  run: () => PromiseLike<Answer>,
): Promise<Result<z.infer<S>>> {
  const { data, error } = await run();
  if (error) return { ok: false, error: errorFromDatabase(error.message) };
  const parsed = schema.safeParse(data);
  return parsed.success ? ok(parsed.data) : fail("unexpected", unexpected);
}

// PostgREST returns a to-one embed as an object; accept a one-item array too.
function one<T extends z.ZodType>(schema: T) {
  return z.union([schema, z.array(schema).length(1).transform((items) => items[0])]);
}

const courseRow = z.object({ id: z.string(), code: z.string() });
const batchRow = z.object({
  id: z.string(),
  school_year: z.string(),
  stale_threshold_days: z.number(),
});
const studentRow = z.object({ id: z.string(), full_name: z.string(), student_number: z.string() });
const deploymentRow = z.object({
  id: z.string(),
  company: one(z.object({ id: z.string(), name: z.string() })),
});
const membershipRow = z.object({
  company_id: z.string(),
  is_owner: z.boolean(),
  user: one(z.object({ full_name: z.string() })),
});
const entryRow = z.object({
  id: z.string(),
  log_date: z.string(),
  time_in: z.string(),
  time_out: z.string().nullable(),
  break_minutes: z.number(),
  status: z.enum(["open", "pending", "approved", "rejected"]),
  journal: z.string().nullable(),
  reject_reason: z.string().nullable(),
  early_out_reason: z.string().nullable(),
  correction_reason: z.string().nullable(),
  reopen_reason: z.string().nullable(),
  added_by: z.string().nullable(),
  deployment: one(
    z.object({
      student: one(z.object({ id: z.string(), full_name: z.string(), student_number: z.string() })),
      company: one(z.object({ id: z.string(), name: z.string() })),
    }),
  ),
});

const entrySelect =
  "id, log_date, time_in, time_out, break_minutes, status, journal, reject_reason, early_out_reason, correction_reason, reopen_reason, added_by, deployment:deployments!inner(ojt_batch_id, company_id, student_id, student:students(id, full_name, student_number), company:companies(id, name))";

type Scope = { batchId: string; today: string; cutoff: string };

// One query over the batch's entries with every filter applied. `head` asks for the
// count only.
function entries(scope: Scope, filters: LogFilters, status: LogStatusFilter, head: boolean) {
  let query = db()
    .from("daily_logs")
    .select(entrySelect, head ? { count: "exact", head: true } : { count: "exact" })
    .eq("deployments.ojt_batch_id", scope.batchId);
  if (filters.company) query = query.eq("deployments.company_id", filters.company);
  if (filters.student) query = query.eq("deployments.student_id", filters.student);
  if (filters.from) query = query.gte("log_date", filters.from);
  if (filters.to) query = query.lte("log_date", filters.to);
  switch (status) {
    case "pending":
    case "rejected":
    case "approved":
      return query.eq("status", status);
    case "stale":
      return query.eq("status", "pending").lte("log_date", scope.cutoff);
    case "no-time-out":
      return query.eq("status", "open").lt("log_date", scope.today);
    case "all":
      return query;
  }
}

async function count(scope: Scope, filters: LogFilters, status: LogStatusFilter): Promise<Result<number>> {
  const { count: total, error } = await entries(scope, filters, status, true);
  if (error) return { ok: false, error: errorFromDatabase(error.message) };
  return ok(total ?? 0);
}

// The entries of the coordinator's first course and its newest batch, newest
// first, with the filters applied. Null when there is no course or batch yet.
export async function getLogsView(
  courseIds: readonly string[],
  filters: LogFilters,
): Promise<Result<LogsView | null>> {
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
      .select("id, school_year, stale_threshold_days")
      .eq("course_id", course.id)
      .order("school_year", { ascending: false })
      .limit(1),
  );
  if (!batches.ok) return batches;
  const batch = batches.data[0];
  if (!batch) return ok(null);

  const today = manilaToday();
  const scope: Scope = {
    batchId: batch.id,
    today,
    cutoff: staleCutoff(today, batch.stale_threshold_days),
  };

  const students = await read(z.array(studentRow), () =>
    db()
      .from("students")
      .select("id, full_name, student_number")
      .eq("ojt_batch_id", batch.id)
      .order("full_name")
      .limit(limit),
  );
  if (!students.ok) return students;
  const deployments = await read(z.array(deploymentRow), () =>
    db()
      .from("deployments")
      .select("id, company:companies(id, name)")
      .eq("ojt_batch_id", batch.id)
      .limit(limit),
  );
  if (!deployments.ok) return deployments;

  const names: LogStatusFilter[] = ["all", "pending", "stale", "no-time-out", "rejected", "approved"];
  const totals: number[] = [];
  for (const name of names) {
    const result = await count(scope, filters, name);
    if (!result.ok) return result;
    totals.push(result.data);
  }
  const counts = Object.fromEntries(names.map((name, index) => [name, totals[index]])) as LogCounts;

  const page = await read(z.array(entryRow), () =>
    entries(scope, filters, filters.status, false)
      .order("log_date", { ascending: false })
      .order("id", { ascending: false })
      .range(0, filters.shown - 1),
  );
  if (!page.ok) return page;

  const companyIds = [...new Set(page.data.map((row) => row.deployment.company.id))];
  const memberships =
    companyIds.length === 0
      ? ok([] as z.infer<typeof membershipRow>[])
      : await read(z.array(membershipRow), () =>
          db()
            .from("supervisor_memberships")
            .select("company_id, is_owner, user:users(full_name)")
            .in("company_id", companyIds)
            .order("is_owner", { ascending: false })
            .limit(limit),
        );
  if (!memberships.ok) return memberships;

  const supervisorsOf = new Map<string, string[]>();
  for (const row of memberships.data) {
    const list = supervisorsOf.get(row.company_id) ?? [];
    list.push(row.user.full_name);
    supervisorsOf.set(row.company_id, list);
  }

  const rows: LogRow[] = page.data.map((row) => {
    const waiting = row.status === "pending" ? Math.max(0, daysBetween(row.log_date, today)) : null;
    return {
      id: row.id,
      logDate: row.log_date,
      timeIn: row.time_in,
      timeOut: row.time_out,
      breakMinutes: row.break_minutes,
      status: row.status,
      journal: row.journal,
      rejectReason: row.reject_reason,
      earlyOutReason: row.early_out_reason,
      correctionReason: row.correction_reason,
      reopenReason: row.reopen_reason,
      addedBySupervisor: row.added_by !== null,
      studentId: row.deployment.student.id,
      studentName: row.deployment.student.full_name,
      studentNumber: row.deployment.student.student_number,
      companyName: row.deployment.company.name,
      supervisors: supervisorsOf.get(row.deployment.company.id) ?? [],
      daysWaiting: waiting,
      stale: waiting !== null && waiting > batch.stale_threshold_days,
      noTimeOut: row.status === "open" && row.time_out === null && row.log_date < today,
    };
  });

  const seen = new Map(deployments.data.map((row) => [row.company.id, row.company.name]));
  return ok({
    course: {
      courseShort: course.code,
      batchLabel: batch.school_year,
      staleThresholdDays: batch.stale_threshold_days,
      asOf: today,
    },
    filters,
    total: counts[filters.status],
    counts,
    rows,
    students: students.data.map((row) => ({ id: row.id, name: row.full_name })),
    companies: [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  });
}
