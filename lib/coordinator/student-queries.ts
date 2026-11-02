import "server-only";
import { z } from "zod";
import { adminClient } from "@/lib/db/admin";
import type { StudentDeployment, StudentEntry, StudentView } from "@/lib/coordinator/student-types";
import { studentStatus } from "@/lib/coordinator/status";
import type { SubmittedEvaluation } from "@/lib/evaluations/supervisor-types";
import { errorFromDatabase, fail, ok, type Result } from "@/lib/result";
import { describeSchedule, manilaToday, scheduleInForce } from "@/lib/schedules/logic";
import type { WorkSchedule } from "@/lib/schedules/types";

// Reads for the coordinator's student screen. They use the service role, so the
// caller has already run requireRole(["coordinator"]) and passes the course ids
// from the session, never ids from the browser. The student is looked up only
// among those courses: a student of another course is the same as one that does
// not exist.

const unexpected = "Something went wrong. Try again in a moment.";
const db = () => adminClient();
const money = z.coerce.number();

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

const profileRow = z.object({
  id: z.string(),
  full_name: z.string(),
  student_number: z.string(),
  email: z.string(),
  is_active: z.boolean(),
  course: one(z.object({ code: z.string(), name: z.string() })),
  batch: one(z.object({ school_year: z.string(), required_hours: money })),
});
const applicationRow = z.object({
  id: z.string(),
  status: z.enum(["applied", "accepted", "rejected", "withdrawn"]),
  created_at: z.string(),
  listing: one(z.object({ title: z.string(), company: one(z.object({ name: z.string() })) })),
});
const deploymentRow = z.object({
  id: z.string(),
  status: z.enum(["active", "completed", "ended"]),
  created_at: z.string(),
  company: one(z.object({ name: z.string() })),
});
const hoursRow = z.object({ deployment_id: z.string(), approved_hours: money });
const entryRow = z.object({
  id: z.string(),
  deployment_id: z.string(),
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
});
const scheduleRow = z.object({
  id: z.string(),
  deployment_id: z.string(),
  effective_from: z.string(),
  days: z.array(z.object({ weekday: z.number(), start_time: z.string(), end_time: z.string() })),
});
const evaluationRow = z.object({
  deployment_id: z.string(),
  submitted_at: z.string(),
  overall_comment: z.string().nullable(),
  approved_hours: money,
  required_hours: money,
  form: one(z.object({ version: z.number() })),
  scores: z.array(
    z.object({
      score: z.number(),
      comment: z.string().nullable(),
      criterion: one(z.object({ label: z.string(), position: z.number() })),
    }),
  ),
});
const certificationRow = z.object({ id: z.string(), deployment_id: z.string() });

const trimSeconds = (value: string) => value.slice(0, 5);

function toSchedule(row: z.infer<typeof scheduleRow>): WorkSchedule {
  return {
    id: row.id,
    effectiveFrom: row.effective_from,
    days: row.days
      .map((day) => ({ weekday: day.weekday, start: trimSeconds(day.start_time), end: trimSeconds(day.end_time) }))
      .sort((a, b) => a.weekday - b.weekday),
  };
}

function toEvaluation(row: z.infer<typeof evaluationRow>): SubmittedEvaluation {
  return {
    submittedAt: row.submitted_at,
    overallComment: row.overall_comment,
    formVersion: row.form.version,
    approvedHours: row.approved_hours,
    requiredHours: row.required_hours,
    scores: [...row.scores]
      .sort((a, b) => a.criterion.position - b.criterion.position)
      .map((item) => ({ label: item.criterion.label, score: item.score, comment: item.comment })),
  };
}

function toEntry(row: z.infer<typeof entryRow>): StudentEntry {
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
  };
}

// One student of the coordinator's courses, with everything the screen shows.
// Null when the student does not exist or belongs to another course.
export async function getStudentView(
  courseIds: readonly string[],
  studentId: string,
): Promise<Result<StudentView | null>> {
  if (courseIds.length === 0 || !z.string().uuid().safeParse(studentId).success) return ok(null);

  const found = await read(z.array(profileRow), () =>
    db()
      .from("students")
      .select(
        "id, full_name, student_number, email, is_active, course:courses(code, name), batch:ojt_batches(school_year, required_hours)",
      )
      .eq("id", studentId)
      .in("course_id", [...courseIds]),
  );
  if (!found.ok) return found;
  const student = found.data[0];
  if (!student) return ok(null);

  const resume = await read(z.array(z.object({ student_id: z.string() })), () =>
    db().from("resumes").select("student_id").eq("student_id", studentId),
  );
  if (!resume.ok) return resume;

  const applications = await read(z.array(applicationRow), () =>
    db()
      .from("applications")
      .select("id, status, created_at, listing:listings(title, company:companies(name))")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
  );
  if (!applications.ok) return applications;

  const deployments = await read(z.array(deploymentRow), () =>
    db()
      .from("deployments")
      .select("id, status, created_at, company:companies(name)")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
  );
  if (!deployments.ok) return deployments;

  const ids = deployments.data.map((deployment) => deployment.id);
  let hours: z.infer<typeof hoursRow>[] = [];
  let entries: z.infer<typeof entryRow>[] = [];
  let schedules: z.infer<typeof scheduleRow>[] = [];
  let evaluations: z.infer<typeof evaluationRow>[] = [];
  let certifications: z.infer<typeof certificationRow>[] = [];

  if (ids.length > 0) {
    const [h, e, s, v, c] = await Promise.all([
      read(z.array(hoursRow), () =>
        db().from("deployment_hours").select("deployment_id, approved_hours").in("deployment_id", ids),
      ),
      read(z.array(entryRow), () =>
        db()
          .from("daily_logs")
          .select(
            "id, deployment_id, log_date, time_in, time_out, break_minutes, status, journal, reject_reason, early_out_reason, correction_reason, reopen_reason, added_by",
          )
          .in("deployment_id", ids)
          .order("log_date", { ascending: false })
          .limit(1000),
      ),
      read(z.array(scheduleRow), () =>
        db()
          .from("work_schedules")
          .select("id, deployment_id, effective_from, days:work_schedule_days(weekday, start_time, end_time)")
          .in("deployment_id", ids),
      ),
      read(z.array(evaluationRow), () =>
        db()
          .from("evaluations")
          .select(
            "deployment_id, submitted_at, overall_comment, approved_hours, required_hours, form:evaluation_forms(version), scores:evaluation_scores(score, comment, criterion:evaluation_criteria(label, position))",
          )
          .in("deployment_id", ids),
      ),
      read(z.array(certificationRow), () =>
        db()
          .from("certifications")
          .select("id, deployment_id")
          .in("deployment_id", ids)
          .eq("status", "issued"),
      ),
    ]);
    for (const result of [h, e, s, v, c]) if (!result.ok) return result;
    if (h.ok) hours = h.data;
    if (e.ok) entries = e.data;
    if (s.ok) schedules = s.data;
    if (v.ok) evaluations = v.data;
    if (c.ok) certifications = c.data;
  }

  const today = manilaToday();
  const blocks: StudentDeployment[] = deployments.data.map((deployment) => {
    const own = entries.filter((entry) => entry.deployment_id === deployment.id);
    const current = scheduleInForce(
      schedules.filter((schedule) => schedule.deployment_id === deployment.id).map(toSchedule),
      today,
    );
    const evaluation = evaluations.find((row) => row.deployment_id === deployment.id);
    return {
      id: deployment.id,
      status: deployment.status,
      companyName: deployment.company.name,
      startedAt: deployment.created_at,
      approvedHours: hours.find((row) => row.deployment_id === deployment.id)?.approved_hours ?? 0,
      pendingEntries: own.filter((entry) => entry.status === "pending").length,
      schedule: current ? describeSchedule(current.days) : null,
      entries: own.map(toEntry),
      evaluation: evaluation ? toEvaluation(evaluation) : null,
      certificationId: certifications.find((row) => row.deployment_id === deployment.id)?.id ?? null,
    };
  });

  const totalHours = Math.round(blocks.reduce((sum, block) => sum + block.approvedHours, 0) * 100) / 100;
  return ok({
    profile: {
      id: student.id,
      name: student.full_name,
      studentNumber: student.student_number,
      email: student.email,
      isActive: student.is_active,
      courseLabel: `${student.course.code}, ${student.course.name}`,
      batchLabel: student.batch.school_year,
      requiredHours: student.batch.required_hours,
    },
    stage: studentStatus({
      deployments: blocks,
      openApplications: applications.data.filter((row) => row.status === "applied").length,
      approvedHours: totalHours,
      requiredHours: student.batch.required_hours,
    }),
    hasResume: resume.data.length > 0,
    applications: applications.data.map((row) => ({
      id: row.id,
      status: row.status,
      appliedAt: row.created_at,
      listingTitle: row.listing.title,
      companyName: row.listing.company.name,
    })),
    deployments: blocks,
  });
}
