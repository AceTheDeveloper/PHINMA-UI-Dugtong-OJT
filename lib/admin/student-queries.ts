import "server-only";
import { z } from "zod";
import { adminClient } from "@/lib/db/admin";
import { studentStatus } from "@/lib/coordinator/status";
import type { DashboardCompany, DashboardStudent } from "@/lib/coordinator/types";
import { errorFromDatabase, fail, ok, type Result } from "@/lib/result";

// Reads for the Platform Admin students directory. Uses the service-role client,
// so callers must run requireRole(["admin"]) first.
const unexpected = "Something went wrong. Try again in a moment.";
const db = () => adminClient();
const limit = 2000;

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

const money = z.coerce.number();

const courseRow = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
});

const studentRow = z.object({
  id: z.string(),
  full_name: z.string(),
  student_number: z.string(),
  course_id: z.string(),
  course: one(z.object({ code: z.string(), name: z.string() })),
  batch: one(z.object({ required_hours: money })),
});

const deploymentRow = z.object({
  id: z.string(),
  student_id: z.string(),
  company_id: z.string(),
  status: z.enum(["active", "completed", "ended"]),
  created_at: z.string(),
});

const hoursRow = z.object({
  deployment_id: z.string(),
  approved_hours: money,
});

const companyRow = z.object({
  id: z.string(),
  name: z.string(),
});

const supervisorRow = z.object({
  company_id: z.string(),
});

const entryRow = z.object({
  deployment_id: z.string(),
  status: z.enum(["open", "pending", "approved", "rejected"]),
  log_date: z.string(),
});

const applicationRow = z.object({
  student_id: z.string(),
  status: z.enum(["applied", "accepted", "rejected", "withdrawn"]),
});

export type AdminStudentsData = {
  students: DashboardStudent[];
  companies: DashboardCompany[];
  courses: { id: string; label: string }[];
  requiredHours: number;
};

export async function getAdminStudentsList(): Promise<Result<AdminStudentsData>> {
  const [
    coursesResult,
    studentsResult,
    companiesResult,
    supervisorsResult,
    deploymentsResult,
    hoursResult,
    entriesResult,
    applicationsResult,
  ] = await Promise.all([
    read(z.array(courseRow), () =>
      db().from("courses").select("id, code, name").order("code"),
    ),
    read(z.array(studentRow), () =>
      db()
        .from("students")
        .select(
          "id, full_name, student_number, course_id, course:courses(code, name), batch:ojt_batches(required_hours)",
        )
        .eq("is_active", true)
        .order("full_name")
        .limit(limit),
    ),
    read(z.array(companyRow), () =>
      db().from("companies").select("id, name").order("name"),
    ),
    read(z.array(supervisorRow), () =>
      db().from("supervisor_memberships").select("company_id"),
    ),
    read(z.array(deploymentRow), () =>
      db()
        .from("deployments")
        .select("id, student_id, company_id, status, created_at")
        .order("created_at", { ascending: false })
        .limit(limit),
    ),
    read(z.array(hoursRow), () =>
      db().from("deployment_hours").select("deployment_id, approved_hours").limit(limit),
    ),
    read(z.array(entryRow), () =>
      db().from("daily_logs").select("deployment_id, status, log_date").limit(limit),
    ),
    read(z.array(applicationRow), () =>
      db().from("applications").select("student_id, status").limit(limit),
    ),
  ]);

  for (const r of [
    coursesResult,
    studentsResult,
    companiesResult,
    supervisorsResult,
    deploymentsResult,
    hoursResult,
    entriesResult,
    applicationsResult,
  ]) {
    if (!r.ok) return r;
  }

  const courses = coursesResult.ok ? coursesResult.data : [];
  const students = studentsResult.ok ? studentsResult.data : [];
  const companies = companiesResult.ok ? companiesResult.data : [];
  const supervisors = supervisorsResult.ok ? supervisorsResult.data : [];
  const deployments = deploymentsResult.ok ? deploymentsResult.data : [];
  const hours = hoursResult.ok ? hoursResult.data : [];
  const entries = entriesResult.ok ? entriesResult.data : [];
  const applications = applicationsResult.ok ? applicationsResult.data : [];

  const hoursByDeployment = new Map(hours.map((h) => [h.deployment_id, h.approved_hours]));

  const supervisorsByCompany = new Map<string, number>();
  for (const sup of supervisors) {
    supervisorsByCompany.set(
      sup.company_id,
      (supervisorsByCompany.get(sup.company_id) ?? 0) + 1,
    );
  }

  const dashboardCompanies: DashboardCompany[] = companies.map((c) => ({
    id: c.id,
    name: c.name,
    supervisors: supervisorsByCompany.get(c.id) ?? 0,
  }));

  const dashboardStudents: DashboardStudent[] = students.map((student) => {
    const studentDeployments = deployments.filter((d) => d.student_id === student.id);
    const dtrDeployment =
      studentDeployments.find((d) => d.status === "active") ??
      studentDeployments.find((d) => d.status === "completed") ??
      studentDeployments[0] ??
      null;

    const deploymentIds = new Set(studentDeployments.map((d) => d.id));
    const studentEntries = entries.filter((e) => deploymentIds.has(e.deployment_id));
    const openApps = applications.filter(
      (a) => a.student_id === student.id && a.status === "applied",
    ).length;

    let totalHours = 0;
    for (const d of studentDeployments) {
      totalHours += hoursByDeployment.get(d.id) ?? 0;
    }
    totalHours = Math.round(totalHours * 100) / 100;

    const pendingCount = studentEntries.filter((e) => e.status === "pending").length;
    let latestLogDate: string | null = null;
    for (const e of studentEntries) {
      if (!latestLogDate || e.log_date > latestLogDate) {
        latestLogDate = e.log_date;
      }
    }

    const stage = studentStatus({
      deployments: studentDeployments.map((d) => ({
        id: d.id,
        status: d.status,
        approvedHours: hoursByDeployment.get(d.id) ?? 0,
      })),
      openApplications: openApps,
      approvedHours: totalHours,
      requiredHours: student.batch.required_hours,
    });

    return {
      id: student.id,
      name: student.full_name,
      studentNumber: student.student_number,
      companyId: dtrDeployment?.company_id ?? null,
      deploymentId: dtrDeployment?.id ?? null,
      status: stage,
      approvedHours: totalHours,
      pendingEntries: pendingCount,
      lastEntryDate: latestLogDate,
      courseId: student.course_id,
      courseCode: student.course.code,
    };
  });

  return ok({
    students: dashboardStudents,
    companies: dashboardCompanies,
    courses: courses.map((c) => ({ id: c.id, label: `${c.code} · ${c.name}` })),
    requiredHours: students[0]?.batch.required_hours ?? 300,
  });
}
