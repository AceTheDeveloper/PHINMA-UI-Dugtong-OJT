import "server-only";
import { z } from "zod";
import { adminClient } from "@/lib/db/admin";
import type { ReviewEntry, ReviewQueue } from "@/lib/review/types";
import { errorFromDatabase, fail, ok, type Result } from "@/lib/result";
import { manilaToday } from "@/lib/schedules/logic";

// Reads for the supervisor's daily approval. They use the service role, so every
// caller has already run requireRole(["supervisor"]) and passes the company from
// the session, never one from the browser.

const unexpected = "Something went wrong. Try again in a moment.";
const db = () => adminClient();

async function read<S extends z.ZodType>(
  schema: S,
  run: () => PromiseLike<{ data: unknown; error: { message: string } | null }>,
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

const trimSeconds = (value: string | null) => (value ? value.slice(0, 5) : null);

const row = z.object({
  id: z.string(),
  deployment_id: z.string(),
  log_date: z.string(),
  time_in: z.string(),
  time_out: z.string().nullable(),
  status: z.enum(["open", "pending", "approved", "rejected"]),
  journal: z.string().nullable(),
  reject_reason: z.string().nullable(),
  early_out_reason: z.string().nullable(),
  correction_reason: z.string().nullable(),
  reopen_reason: z.string().nullable(),
  added_by: z.string().nullable(),
  break_minutes: z.number(),
  schedule_start: z.string().nullable(),
  schedule_end: z.string().nullable(),
  deployment: one(
    z.object({
      student: one(z.object({ full_name: z.string(), student_number: z.string() })),
      company: one(z.object({ name: z.string() })),
    }),
  ),
});

const select =
  "id, deployment_id, log_date, time_in, time_out, status, journal, reject_reason, early_out_reason, correction_reason, reopen_reason, added_by, break_minutes, schedule_start, schedule_end, deployment:deployments!inner(company_id, student:students(full_name, student_number), company:companies(name))";

function toEntry(item: z.infer<typeof row>): ReviewEntry {
  return {
    id: item.id,
    deploymentId: item.deployment_id,
    logDate: item.log_date,
    timeIn: item.time_in,
    timeOut: item.time_out,
    status: item.status,
    journal: item.journal,
    rejectReason: item.reject_reason,
    earlyOutReason: item.early_out_reason,
    correctionReason: item.correction_reason,
    reopenReason: item.reopen_reason,
    addedBySupervisor: item.added_by !== null,
    breakMinutes: item.break_minutes,
    scheduleStart: trimSeconds(item.schedule_start),
    scheduleEnd: trimSeconds(item.schedule_end),
    companyName: item.deployment.company.name,
    studentName: item.deployment.student.full_name,
    studentNumber: item.deployment.student.student_number,
  };
}

// What waits for this supervisor: submitted entries to decide on, and entries
// from earlier days that were never closed. Today's open entries are the
// student's own business and are not listed.
export async function getReviewQueue(companyId: string): Promise<Result<ReviewQueue>> {
  const pending = await read(z.array(row), () =>
    db()
      .from("daily_logs")
      .select(select)
      .eq("deployments.company_id", companyId)
      .eq("status", "pending")
      .order("log_date", { ascending: false })
      .limit(500),
  );
  if (!pending.ok) return pending;

  const open = await read(z.array(row), () =>
    db()
      .from("daily_logs")
      .select(select)
      .eq("deployments.company_id", companyId)
      .eq("status", "open")
      .lt("log_date", manilaToday())
      .order("log_date", { ascending: false })
      .limit(500),
  );
  if (!open.ok) return open;

  return ok({ pending: pending.data.map(toEntry), needsTimeOut: open.data.map(toEntry) });
}

// Every entry of one student of this company, newest first. A deployment of
// another company gives an empty list, the same as one with no entries.
export async function getEntriesForDeployment(
  companyId: string,
  deploymentId: string,
): Promise<Result<ReviewEntry[]>> {
  if (!z.string().uuid().safeParse(deploymentId).success) return ok([]);
  const rows = await read(z.array(row), () =>
    db()
      .from("daily_logs")
      .select(select)
      .eq("deployments.company_id", companyId)
      .eq("deployment_id", deploymentId)
      .order("log_date", { ascending: false })
      .limit(400),
  );
  if (!rows.ok) return rows;
  return ok(rows.data.map(toEntry));
}
