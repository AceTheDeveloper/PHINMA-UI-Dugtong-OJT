import "server-only";
import { z } from "zod";
import { adminClient } from "@/lib/db/admin";
import { studentStatus } from "@/lib/coordinator/status";
import type {
  Activity,
  Dashboard,
  DashboardCompany,
  DashboardStudent,
  OpenEntry,
  PendingEntry,
  WeeklyHours,
} from "@/lib/coordinator/types";
import { errorFromDatabase, fail, ok, type Result } from "@/lib/result";
import { manilaToday } from "@/lib/schedules/logic";

// Reads for the coordinator dashboard. They use the service role, so every
// caller has already run requireRole(["coordinator"]) and passes the course ids
// from the session, never ids from the browser. Everything is keyed by the OJT
// batch of the course, so a coordinator only ever sees their own students.
//
// The API returns at most 1000 rows a request. A batch of that size is far above
// a BSIT class; totals that could grow past it (hours per week, entry counts per
// student) are computed in the database (migration 21), not here.

const unexpected = "Something went wrong. Try again in a moment.";
const db = () => adminClient();
const limit = 1000;

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

const money = z.coerce.number();

// Whole days from one school date to another (both YYYY-MM-DD).
export function daysBetween(from: string, to: string): number {
  const day = 86_400_000;
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / day);
}

const courseRow = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  department: one(z.object({ code: z.string(), name: z.string() })),
});
const batchRow = z.object({
  id: z.string(),
  school_year: z.string(),
  required_hours: money,
  stale_threshold_days: z.number(),
});
const studentRow = z.object({ id: z.string(), full_name: z.string(), student_number: z.string() });
const deploymentRow = z.object({
  id: z.string(),
  student_id: z.string(),
  company_id: z.string(),
  status: z.enum(["active", "completed", "ended"]),
});
const hoursRow = z.object({ deployment_id: z.string(), approved_hours: money });
const activityRow = z.object({
  deployment_id: z.string(),
  student_id: z.string(),
  last_entry_date: z.string().nullable(),
  pending_entries: z.number(),
});
const applicationRow = z.object({ student_id: z.string() });
const companyRow = z.object({ id: z.string(), name: z.string() });
const membershipRow = z.object({ company_id: z.string() });
const entryRow = z.object({
  id: z.string(),
  log_date: z.string(),
  deployment: one(z.object({ student_id: z.string() })),
});
const weeklyRow = z.object({ week_start: z.string(), hours: money });
const auditRow = z.object({
  id: z.number(),
  table_name: z.string(),
  row_id: z.string(),
  action: z.string(),
  old_value: z.record(z.string(), z.unknown()).nullable(),
  new_value: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string(),
});

export type DashboardResult = Result<Dashboard | null>;

// The dashboard of the coordinator's first course and its newest OJT batch.
// Null when there is no course or no batch yet.
export async function getDashboard(courseIds: readonly string[]): Promise<DashboardResult> {
  if (courseIds.length === 0) return ok(null);

  const courses = await read(z.array(courseRow), () =>
    db()
      .from("courses")
      .select("id, code, name, department:departments(code, name)")
      .in("id", [...courseIds])
      .order("code"),
  );
  if (!courses.ok) return courses;
  const course = courses.data[0];
  if (!course) return ok(null);

  const school = await read(z.array(z.object({ name: z.string() })), () =>
    db().from("school_settings").select("name"),
  );
  if (!school.ok) return school;

  const batches = await read(z.array(batchRow), () =>
    db()
      .from("ojt_batches")
      .select("id, school_year, required_hours, stale_threshold_days")
      .eq("course_id", course.id)
      .order("school_year", { ascending: false })
      .limit(1),
  );
  if (!batches.ok) return batches;
  const batch = batches.data[0];
  if (!batch) return ok(null);

  const today = manilaToday();

  const students = await read(z.array(studentRow), () =>
    db()
      .from("students")
      .select("id, full_name, student_number")
      .eq("ojt_batch_id", batch.id)
      .eq("is_active", true)
      .order("full_name")
      .limit(limit),
  );
  if (!students.ok) return students;

  const deployments = await read(z.array(deploymentRow), () =>
    db()
      .from("deployments")
      .select("id, student_id, company_id, status")
      .eq("ojt_batch_id", batch.id)
      .limit(limit),
  );
  if (!deployments.ok) return deployments;

  const hours = await read(z.array(hoursRow), () =>
    db()
      .from("deployment_hours")
      .select("deployment_id, approved_hours")
      .eq("ojt_batch_id", batch.id)
      .limit(limit),
  );
  if (!hours.ok) return hours;

  const activity = await read(z.array(activityRow), () =>
    db()
      .from("deployment_activity")
      .select("deployment_id, student_id, last_entry_date, pending_entries")
      .eq("ojt_batch_id", batch.id)
      .limit(limit),
  );
  if (!activity.ok) return activity;

  const applications = await read(z.array(applicationRow), () =>
    db()
      .from("applications")
      .select("student_id, student:students!inner(ojt_batch_id)")
      .eq("status", "applied")
      .eq("students.ojt_batch_id", batch.id)
      .limit(limit),
  );
  if (!applications.ok) return applications;

  const companies = await read(z.array(companyRow), () =>
    db().from("companies").select("id, name").eq("status", "active").order("name").limit(limit),
  );
  if (!companies.ok) return companies;
  const memberships = await read(z.array(membershipRow), () =>
    db().from("supervisor_memberships").select("company_id").limit(limit),
  );
  if (!memberships.ok) return memberships;

  const entrySelect = "id, log_date, deployment:deployments!inner(student_id, ojt_batch_id)";
  const pending = await read(z.array(entryRow), () =>
    db()
      .from("daily_logs")
      .select(entrySelect)
      .eq("deployments.ojt_batch_id", batch.id)
      .eq("status", "pending")
      .order("log_date")
      .limit(limit),
  );
  if (!pending.ok) return pending;
  const open = await read(z.array(entryRow), () =>
    db()
      .from("daily_logs")
      .select(entrySelect)
      .eq("deployments.ojt_batch_id", batch.id)
      .eq("status", "open")
      .lt("log_date", today)
      .order("log_date")
      .limit(limit),
  );
  if (!open.ok) return open;

  const weekly = await read(z.array(weeklyRow), () =>
    db().rpc("weekly_approved_hours", { p_batch_id: batch.id, p_weeks: 8 }),
  );
  if (!weekly.ok) return weekly;

  const audit = await read(z.array(auditRow), () =>
    db()
      .from("audit_log")
      .select("id, table_name, row_id, action, old_value, new_value, created_at")
      .in("table_name", ["evaluations", "certifications", "deployments", "ojt_batches"])
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(200),
  );
  if (!audit.ok) return audit;

  // Put it together.
  const hoursOf = new Map<string, number>();
  for (const row of hours.data) hoursOf.set(row.deployment_id, row.approved_hours);
  const activityOf = new Map(activity.data.map((row) => [row.deployment_id, row]));
  const openApplications = new Map<string, number>();
  for (const row of applications.data) {
    openApplications.set(row.student_id, (openApplications.get(row.student_id) ?? 0) + 1);
  }

  const rows: DashboardStudent[] = students.data.map((student) => {
    const own = deployments.data.filter((deployment) => deployment.student_id === student.id);
    const approvedHours =
      Math.round(own.reduce((sum, deployment) => sum + (hoursOf.get(deployment.id) ?? 0), 0) * 100) /
      100;
    const current =
      own.find((deployment) => deployment.status === "active") ??
      own.find((deployment) => deployment.status === "completed") ??
      own[0];
    const dates = own
      .map((deployment) => activityOf.get(deployment.id)?.last_entry_date ?? null)
      .filter((date): date is string => date !== null)
      .sort();
    return {
      id: student.id,
      name: student.full_name,
      studentNumber: student.student_number,
      companyId: current?.company_id ?? null,
      deploymentId: current?.id ?? null,
      status: studentStatus({
        deployments: own,
        openApplications: openApplications.get(student.id) ?? 0,
        approvedHours,
        requiredHours: batch.required_hours,
      }),
      approvedHours,
      pendingEntries: own.reduce(
        (sum, deployment) => sum + (activityOf.get(deployment.id)?.pending_entries ?? 0),
        0,
      ),
      lastEntryDate: dates.at(-1) ?? null,
    };
  });

  const supervisorsOf = new Map<string, number>();
  for (const row of memberships.data) {
    supervisorsOf.set(row.company_id, (supervisorsOf.get(row.company_id) ?? 0) + 1);
  }
  const companyList: DashboardCompany[] = companies.data.map((company) => ({
    id: company.id,
    name: company.name,
    supervisors: supervisorsOf.get(company.id) ?? 0,
  }));

  const knownStudents = new Set(rows.map((row) => row.id));
  const pendingEntries: PendingEntry[] = pending.data
    .filter((entry) => knownStudents.has(entry.deployment.student_id))
    .map((entry) => ({
      id: entry.id,
      studentId: entry.deployment.student_id,
      date: entry.log_date,
      daysWaiting: Math.max(0, daysBetween(entry.log_date, today)),
    }));
  const openEntries: OpenEntry[] = open.data
    .filter((entry) => knownStudents.has(entry.deployment.student_id))
    .map((entry) => ({ id: entry.id, studentId: entry.deployment.student_id, date: entry.log_date }));

  const weeks: WeeklyHours[] = weekly.data.map((row) => ({
    weekStart: row.week_start,
    hours: row.hours,
  }));

  return ok({
    course: {
      batchId: batch.id,
      school: school.data[0]?.name ?? "",
      department: course.department.name,
      departmentShort: course.department.code,
      course: course.name,
      courseShort: course.code,
      batchLabel: batch.school_year,
      requiredHours: batch.required_hours,
      staleThresholdDays: batch.stale_threshold_days,
      asOf: today,
    },
    otherCourses: courses.data.length - 1,
    students: rows,
    companies: companyList,
    pending: pendingEntries,
    open: openEntries,
    activity: activityFrom(audit.data, {
      batchId: batch.id,
      deployments: deployments.data,
      students: students.data,
      companies: companies.data,
    }),
    weekly: weeks,
  });
}

type ActivityContext = {
  batchId: string;
  deployments: z.infer<typeof deploymentRow>[];
  students: z.infer<typeof studentRow>[];
  companies: z.infer<typeof companyRow>[];
};

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

// The coordinator's own course only, in plain sentences: evaluations submitted,
// certifications issued, deployments created, and required hours changed. The
// newest eight.
export function activityFrom(
  audit: readonly z.infer<typeof auditRow>[],
  context: ActivityContext,
): Activity[] {
  const deploymentById = new Map(context.deployments.map((row) => [row.id, row]));
  const studentName = (deploymentId: string | null) => {
    const deployment = deploymentId ? deploymentById.get(deploymentId) : undefined;
    return context.students.find((student) => student.id === deployment?.student_id)?.full_name ?? null;
  };
  const companyName = (deploymentId: string) => {
    const deployment = deploymentById.get(deploymentId);
    return context.companies.find((company) => company.id === deployment?.company_id)?.name ?? null;
  };

  const events: Activity[] = [];
  for (const row of audit) {
    let sentence: string | null = null;
    const deploymentId = text(row.new_value?.deployment_id) ?? null;
    if (row.table_name === "evaluations" && row.action === "insert" && deploymentId) {
      const name = studentName(deploymentId);
      if (name) sentence = `The supervisor submitted the evaluation of ${name}.`;
    } else if (row.table_name === "certifications" && row.action === "insert" && deploymentId) {
      const name = studentName(deploymentId);
      if (name) sentence = `A certification was issued to ${name}.`;
    } else if (row.table_name === "deployments" && row.action === "insert") {
      const name = studentName(row.row_id);
      const company = companyName(row.row_id);
      if (name) sentence = company ? `${name} started at ${company}.` : `${name} started a deployment.`;
    } else if (
      row.table_name === "ojt_batches" &&
      row.action === "update" &&
      row.row_id === context.batchId &&
      row.old_value &&
      row.new_value &&
      row.old_value.required_hours !== undefined &&
      row.new_value.required_hours !== undefined &&
      Number(row.old_value.required_hours) !== Number(row.new_value.required_hours)
    ) {
      sentence = `Required hours changed from ${Number(row.old_value.required_hours)} to ${Number(row.new_value.required_hours)}.`;
    }
    if (sentence) events.push({ id: String(row.id), text: sentence, at: row.created_at });
    if (events.length === 8) break;
  }
  return events;
}

export type BatchScope = { courseId: string; isNewest: boolean };

// The course of an OJT batch, and whether it is that course's newest batch (the
// one the dashboard shows). Null when there is no such batch. The caller checks
// the course against the session before it writes.
export async function getBatchScope(batchId: string): Promise<Result<BatchScope | null>> {
  const found = await read(z.array(z.object({ id: z.string(), course_id: z.string() })), () =>
    db().from("ojt_batches").select("id, course_id").eq("id", batchId).limit(1),
  );
  if (!found.ok) return found;
  const batch = found.data[0];
  if (!batch) return ok(null);

  const newest = await read(z.array(z.object({ id: z.string() })), () =>
    db()
      .from("ojt_batches")
      .select("id")
      .eq("course_id", batch.course_id)
      .order("school_year", { ascending: false })
      .limit(1),
  );
  if (!newest.ok) return newest;
  return ok({ courseId: batch.course_id, isNewest: newest.data[0]?.id === batch.id });
}
