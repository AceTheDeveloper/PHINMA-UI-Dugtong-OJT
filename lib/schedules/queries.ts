import "server-only";
import { z } from "zod";
import { adminClient } from "@/lib/db/admin";
import { errorFromDatabase, fail, ok, type Result } from "@/lib/result";
import { manilaToday, scheduleInForce, summarizeSchedule } from "@/lib/schedules/logic";
import type { StudentDetail, StudentRow, WorkSchedule } from "@/lib/schedules/types";

// Reads for the supervisor Students screens. They use the service role, so
// every caller has already run requireRole(["supervisor"]) and passes the
// company from the session, never one from the browser.

const unexpected = "Something went wrong. Try again in a moment.";
const db = () => adminClient();
const deploymentStatus = z.enum(["active", "completed", "ended"]);

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

const trimSeconds = (value: string) => value.slice(0, 5);

const deploymentRow = z.object({
  id: z.string(),
  status: deploymentStatus,
  student: one(z.object({ full_name: z.string(), student_number: z.string() })),
  batch: one(z.object({ required_hours: z.coerce.number() })),
});

const deploymentSelect =
  "id, status, student:students(full_name, student_number), batch:ojt_batches(required_hours)";

const scheduleRow = z.object({
  id: z.string(),
  deployment_id: z.string(),
  effective_from: z.string(),
  days: z.array(
    z.object({ weekday: z.number(), start_time: z.string(), end_time: z.string() }),
  ),
});

const scheduleSelect =
  "id, deployment_id, effective_from, days:work_schedule_days(weekday, start_time, end_time)";

function toSchedule(row: z.infer<typeof scheduleRow>): WorkSchedule {
  return {
    id: row.id,
    effectiveFrom: row.effective_from,
    days: row.days
      .map((day) => ({
        weekday: day.weekday,
        start: trimSeconds(day.start_time),
        end: trimSeconds(day.end_time),
      }))
      .sort((a, b) => a.weekday - b.weekday),
  };
}

const hoursRow = z.object({ deployment_id: z.string(), approved_hours: z.coerce.number() });

// Students of this company, active ones first, with approved hours and the
// schedule in force today.
export async function getStudentsForCompany(companyId: string): Promise<Result<StudentRow[]>> {
  const deployments = await read(z.array(deploymentRow), () =>
    db().from("deployments").select(deploymentSelect).eq("company_id", companyId).limit(1000),
  );
  if (!deployments.ok) return deployments;

  const hours = await read(z.array(hoursRow), () =>
    db()
      .from("deployment_hours")
      .select("deployment_id, approved_hours")
      .eq("company_id", companyId)
      .limit(1000),
  );
  if (!hours.ok) return hours;

  const schedules = await read(z.array(scheduleRow), () =>
    db()
      .from("work_schedules")
      .select(`${scheduleSelect}, deployment:deployments!inner(company_id)`)
      .eq("deployments.company_id", companyId)
      .limit(5000),
  );
  if (!schedules.ok) return schedules;

  const today = manilaToday();
  const hoursOf = new Map(hours.data.map((row) => [row.deployment_id, row.approved_hours]));
  const rows = deployments.data.map((row): StudentRow => {
    const own = schedules.data
      .filter((schedule) => schedule.deployment_id === row.id)
      .map(toSchedule);
    const current = scheduleInForce(own, today);
    return {
      deploymentId: row.id,
      status: row.status,
      studentName: row.student.full_name,
      studentNumber: row.student.student_number,
      approvedHours: hoursOf.get(row.id) ?? 0,
      requiredHours: row.batch.required_hours,
      scheduleSummary: current ? summarizeSchedule(current.days) : null,
    };
  });
  // Active first, then by name.
  rows.sort(
    (a, b) =>
      Number(b.status === "active") - Number(a.status === "active") ||
      a.studentName.localeCompare(b.studentName),
  );
  return ok(rows);
}

// One student of this company. A deployment of another company is "not found",
// the same as one that does not exist.
export async function getStudentDetail(
  companyId: string,
  deploymentId: string,
): Promise<Result<StudentDetail>> {
  if (!z.string().uuid().safeParse(deploymentId).success) {
    return fail("not_found", "This student was not found.");
  }
  const found = await read(z.array(deploymentRow), () =>
    db()
      .from("deployments")
      .select(deploymentSelect)
      .eq("id", deploymentId)
      .eq("company_id", companyId),
  );
  if (!found.ok) return found;
  const row = found.data[0];
  if (!row) return fail("not_found", "This student was not found.");

  const hours = await read(z.array(hoursRow), () =>
    db()
      .from("deployment_hours")
      .select("deployment_id, approved_hours")
      .eq("deployment_id", deploymentId),
  );
  if (!hours.ok) return hours;

  const schedules = await read(z.array(scheduleRow), () =>
    db()
      .from("work_schedules")
      .select(scheduleSelect)
      .eq("deployment_id", deploymentId)
      .order("effective_from", { ascending: false }),
  );
  if (!schedules.ok) return schedules;

  return ok({
    deploymentId: row.id,
    status: row.status,
    studentName: row.student.full_name,
    studentNumber: row.student.student_number,
    approvedHours: hours.data[0]?.approved_hours ?? 0,
    requiredHours: row.batch.required_hours,
    schedules: schedules.data.map(toSchedule),
  });
}
