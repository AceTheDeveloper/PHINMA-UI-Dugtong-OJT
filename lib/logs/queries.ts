import "server-only";
import { z } from "zod";
import { adminClient } from "@/lib/db/admin";
import { isoWeekday, todayView } from "@/lib/logs/logic";
import { buildWeek, weekDates, type WeekDay } from "@/lib/logs/week";
import type { LogEntry, TodayView } from "@/lib/logs/types";
import { errorFromDatabase, fail, ok, type Result } from "@/lib/result";
import { manilaToday, scheduleInForce } from "@/lib/schedules/logic";
import { getSchedulesForDeployment } from "@/lib/schedules/queries";

// Reads for the student's daily log. They use the service role, so every caller
// has already run authorize(["student"]) and passes the student from the
// session, never one from the browser.

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

const logRow = z.object({
  id: z.string(),
  log_date: z.string(),
  time_in: z.string(),
  time_out: z.string().nullable(),
  status: z.enum(["open", "pending", "approved", "rejected"]),
  journal: z.string().nullable(),
  reject_reason: z.string().nullable(),
  early_out_reason: z.string().nullable(),
  break_minutes: z.number(),
  schedule_start: z.string().nullable(),
  schedule_end: z.string().nullable(),
  deployment: one(z.object({ company: one(z.object({ name: z.string() })) })),
});

const logSelect =
  "id, log_date, time_in, time_out, status, journal, reject_reason, early_out_reason, break_minutes, schedule_start, schedule_end, deployment:deployments!inner(student_id, company:companies(name))";

function toEntry(row: z.infer<typeof logRow>): LogEntry {
  return {
    id: row.id,
    logDate: row.log_date,
    timeIn: row.time_in,
    timeOut: row.time_out,
    status: row.status,
    journal: row.journal,
    rejectReason: row.reject_reason,
    earlyOutReason: row.early_out_reason,
    breakMinutes: row.break_minutes,
    scheduleStart: trimSeconds(row.schedule_start),
    scheduleEnd: trimSeconds(row.schedule_end),
    companyName: row.deployment.company.name,
  };
}

// The student's entries, newest first.
export async function getLogsForStudent(studentId: string): Promise<Result<LogEntry[]>> {
  const rows = await read(z.array(logRow), () =>
    db()
      .from("daily_logs")
      .select(logSelect)
      .eq("deployments.student_id", studentId)
      .order("log_date", { ascending: false })
      .limit(400),
  );
  if (!rows.ok) return rows;
  return ok(rows.data.map(toEntry));
}

// What the Today panel shows for this student, with the company they are at.
export async function getTodayForStudent(
  studentId: string,
): Promise<Result<{ companyName: string | null; view: TodayView }>> {
  const deployments = await read(
    z.array(z.object({ id: z.string(), company: one(z.object({ name: z.string() })) })),
    () =>
      db()
        .from("deployments")
        .select("id, company:companies(name)")
        .eq("student_id", studentId)
        .eq("status", "active"),
  );
  if (!deployments.ok) return deployments;
  const deployment = deployments.data[0];
  const now = new Date();
  const today = manilaToday(now);

  // A student who is no longer deployed can still have an entry from today.
  const todays = await read(z.array(logRow), () =>
    db()
      .from("daily_logs")
      .select(logSelect)
      .eq("deployments.student_id", studentId)
      .eq("log_date", today)
      .limit(1),
  );
  if (!todays.ok) return todays;
  const entry = todays.data[0] ? toEntry(todays.data[0]) : null;

  if (!deployment) {
    return ok({
      companyName: entry?.companyName ?? null,
      view: todayView({ now, today, hasDeployment: false, hasSchedule: false, day: null, entry, windowMinutes: 0 }),
    });
  }

  const schedules = await getSchedulesForDeployment(deployment.id);
  if (!schedules.ok) return schedules;
  const settings = await read(z.array(z.object({ time_in_window_minutes: z.number() })), () =>
    db().from("school_settings").select("time_in_window_minutes"),
  );
  if (!settings.ok) return settings;

  const current = scheduleInForce(schedules.data, today);
  const weekday = isoWeekday(today);
  const day = current?.days.find((item) => item.weekday === weekday) ?? null;
  return ok({
    companyName: deployment.company.name,
    view: todayView({
      now,
      today,
      hasDeployment: true,
      hasSchedule: current !== null,
      day,
      entry,
      windowMinutes: settings.data[0]?.time_in_window_minutes ?? 30,
    }),
  });
}

const weekEntryRow = z.object({
  log_date: z.string(),
  time_in: z.string(),
  time_out: z.string().nullable(),
  break_minutes: z.number(),
  status: z.enum(["open", "pending", "approved", "rejected"]),
});

export type WeekView = { days: WeekDay[]; approvedMinutes: number };

// The student's current week as seven days: what each one stamped, and the week's
// approved minutes. Null when the student has no active deployment. A day is a
// working day when the schedule in force on that date lists its weekday.
export async function getWeekForStudent(studentId: string): Promise<Result<WeekView | null>> {
  const deployments = await read(z.array(z.object({ id: z.string() })), () =>
    db().from("deployments").select("id").eq("student_id", studentId).eq("status", "active").limit(1),
  );
  if (!deployments.ok) return deployments;
  const deployment = deployments.data[0];
  if (!deployment) return ok(null);

  const today = manilaToday();
  const dates = weekDates(today);

  const schedules = await getSchedulesForDeployment(deployment.id);
  if (!schedules.ok) return schedules;
  const entries = await read(z.array(weekEntryRow), () =>
    db()
      .from("daily_logs")
      .select("log_date, time_in, time_out, break_minutes, status")
      .eq("deployment_id", deployment.id)
      .gte("log_date", dates[0])
      .lte("log_date", dates[6]),
  );
  if (!entries.ok) return entries;

  return ok(
    buildWeek({
      today,
      entries: entries.data.map((row) => ({
        logDate: row.log_date,
        timeIn: row.time_in,
        timeOut: row.time_out,
        breakMinutes: row.break_minutes,
        status: row.status,
      })),
      isWorkday: (date) =>
        scheduleInForce(schedules.data, date)?.days.some((day) => day.weekday === isoWeekday(date)) ?? false,
    }),
  );
}
