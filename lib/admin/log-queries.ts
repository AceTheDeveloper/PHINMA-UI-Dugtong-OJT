import "server-only";
import { z } from "zod";
import { adminClient } from "@/lib/db/admin";
import { staleCutoff, type LogFilters, type LogStatusFilter } from "@/lib/coordinator/log-filters";
import type { LogCounts, LogRow, LogsView } from "@/lib/coordinator/log-types";
import { daysBetween } from "@/lib/coordinator/queries";
import { errorFromDatabase, fail, ok, type Result } from "@/lib/result";
import { manilaToday } from "@/lib/schedules/logic";

const unexpected = "Something went wrong. Try again in a moment.";
const db = () => adminClient();
const limit = 1000;
const defaultStaleThreshold = 3;

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

function one<T extends z.ZodType>(schema: T) {
  return z.union([schema, z.array(schema).length(1).transform((items) => items[0])]);
}

const studentRow = z.object({ id: z.string(), full_name: z.string(), student_number: z.string() });
const companyRow = z.object({ id: z.string(), name: z.string() });

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
  "id, log_date, time_in, time_out, break_minutes, status, journal, reject_reason, early_out_reason, correction_reason, reopen_reason, added_by, deployment:deployments!inner(company_id, student_id, student:students(id, full_name, student_number), company:companies(id, name))";

function adminEntries(
  filters: LogFilters,
  status: LogStatusFilter,
  cutoff: string,
  today: string,
  head: boolean,
) {
  let query = db()
    .from("daily_logs")
    .select(entrySelect, head ? { count: "exact", head: true } : { count: "exact" });

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
      return query.eq("status", "pending").lte("log_date", cutoff);
    case "no-time-out":
      return query.eq("status", "open").lt("log_date", today);
    case "all":
      return query;
  }
}

async function countAdminEntries(
  filters: LogFilters,
  status: LogStatusFilter,
  cutoff: string,
  today: string,
): Promise<Result<number>> {
  const { count: total, error } = await adminEntries(filters, status, cutoff, today, true);
  if (error) return { ok: false, error: errorFromDatabase(error.message) };
  return ok(total ?? 0);
}

// System-wide daily logs for Platform Admin across all courses and companies, newest first.
export async function getAdminLogsView(filters: LogFilters): Promise<Result<LogsView>> {
  const today = manilaToday();
  const cutoff = staleCutoff(today, defaultStaleThreshold);

  const [studentsResult, companiesResult] = await Promise.all([
    read(z.array(studentRow), () =>
      db().from("students").select("id, full_name, student_number").order("full_name").limit(limit),
    ),
    read(z.array(companyRow), () =>
      db().from("companies").select("id, name").order("name").limit(limit),
    ),
  ]);

  if (!studentsResult.ok) return studentsResult;
  if (!companiesResult.ok) return companiesResult;

  const names: LogStatusFilter[] = ["all", "pending", "stale", "no-time-out", "rejected", "approved"];
  const totals: number[] = [];
  for (const name of names) {
    const result = await countAdminEntries(filters, name, cutoff, today);
    if (!result.ok) return result;
    totals.push(result.data);
  }
  const counts = Object.fromEntries(names.map((name, index) => [name, totals[index]])) as LogCounts;

  const page = await read(z.array(entryRow), () =>
    adminEntries(filters, filters.status, cutoff, today, false)
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
      stale: waiting !== null && waiting > defaultStaleThreshold,
      noTimeOut: row.status === "open" && row.time_out === null && row.log_date < today,
    };
  });

  return ok({
    course: {
      courseShort: "All courses",
      batchLabel: "All batches",
      staleThresholdDays: defaultStaleThreshold,
      asOf: today,
    },
    filters,
    total: counts[filters.status],
    counts,
    rows,
    students: studentsResult.data.map((row) => ({ id: row.id, name: row.full_name })),
    companies: companiesResult.data.map((row) => ({ id: row.id, name: row.name })),
  });
}
