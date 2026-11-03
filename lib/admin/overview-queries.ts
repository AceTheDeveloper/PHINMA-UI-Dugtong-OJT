import "server-only";
import { z } from "zod";
import { adminClient } from "@/lib/db/admin";
import { staleCutoff } from "@/lib/coordinator/log-filters";
import { errorFromDatabase, fail, ok, type Result } from "@/lib/result";
import { manilaToday } from "@/lib/schedules/logic";

const unexpected = "Something went wrong. Try again in a moment.";
const db = () => adminClient();
const limit = 2000;
const defaultStaleThreshold = 3;

type Answer = { data: unknown; error: { message: string } | null };

async function read<S extends z.ZodType>(
  schema: S,
  run: () => PromiseLike<Answer>,
): Promise<Result<z.infer<S>>> {
  const { data, error } = await run();
  if (error) return { ok: false, error: errorFromDatabase(error.message) };
  const parsed = schema.safeParse(data);
  return parsed.success ? ok(parsed.data) : fail("unexpected", unexpected);
}

const idOnly = z.object({ id: z.string() });
const money = z.coerce.number();

export type AdminOverviewMetrics = {
  // Setup info (preserved from core flow step 1)
  departments: number;
  courses: number;
  batches: number;
  coordinators: number;
  pendingCoordinatorInvitations: number;
  companies: number;
  companiesWithOwner: number;
  pendingSupervisorInvitations: number;

  // Real operational system metrics
  totalStudents: number;
  activeDeployments: number;
  completedDeployments: number;
  applyingStudents: number;
  noApplicationStudents: number;

  pendingEntries: number;
  stalePendingEntries: number;
  openEntries: number;
  totalApprovedHours: number;

  activeListings: number;
  activeCompanies: number;
};

export async function getAdminOverviewMetrics(): Promise<Result<AdminOverviewMetrics>> {
  const cutoff = staleCutoff(manilaToday(), defaultStaleThreshold);

  const [
    departmentsResult,
    coursesResult,
    batchesResult,
    coordinatorsResult,
    invitationsResult,
    companiesResult,
    membershipsResult,
    listingsResult,
    studentsResult,
    deploymentsResult,
    applicationsResult,
    hoursResult,
    logsResult,
  ] = await Promise.all([
    read(z.array(z.object({ id: z.string(), is_active: z.boolean() })), () =>
      db().from("departments").select("id, is_active").eq("is_active", true),
    ),
    read(z.array(z.object({ id: z.string(), is_active: z.boolean() })), () =>
      db().from("courses").select("id, is_active").eq("is_active", true),
    ),
    read(z.array(idOnly), () => db().from("ojt_batches").select("id")),
    read(z.array(z.object({ user_id: z.string() })), () =>
      db().from("coordinator_assignments").select("user_id"),
    ),
    read(z.array(z.object({ role: z.string(), status: z.string() })), () =>
      db().from("invitations").select("role, status").in("role", ["coordinator", "supervisor"]),
    ),
    read(z.array(z.object({ id: z.string(), status: z.enum(["active", "inactive"]) })), () =>
      db().from("companies").select("id, status"),
    ),
    read(z.array(z.object({ company_id: z.string(), is_owner: z.boolean() })), () =>
      db().from("supervisor_memberships").select("company_id, is_owner").eq("is_owner", true),
    ),
    read(z.array(z.object({ id: z.string(), status: z.enum(["open", "closed"]) })), () =>
      db().from("listings").select("id, status"),
    ),
    read(z.array(z.object({ id: z.string(), is_active: z.boolean() })), () =>
      db().from("students").select("id, is_active").eq("is_active", true).limit(limit),
    ),
    read(
      z.array(
        z.object({
          id: z.string(),
          student_id: z.string(),
          status: z.enum(["active", "completed", "ended"]),
        }),
      ),
      () => db().from("deployments").select("id, student_id, status").limit(limit),
    ),
    read(
      z.array(
        z.object({
          id: z.string(),
          student_id: z.string(),
          status: z.enum(["applied", "accepted", "rejected", "withdrawn"]),
        }),
      ),
      () => db().from("applications").select("id, student_id, status").limit(limit),
    ),
    read(z.array(z.object({ approved_hours: money })), () =>
      db().from("deployment_hours").select("approved_hours").limit(limit),
    ),
    read(
      z.array(
        z.object({
          id: z.string(),
          status: z.enum(["open", "pending", "approved", "rejected"]),
          log_date: z.string(),
        }),
      ),
      () => db().from("daily_logs").select("id, status, log_date").in("status", ["open", "pending"]).limit(limit),
    ),
  ]);

  for (const r of [
    departmentsResult,
    coursesResult,
    batchesResult,
    coordinatorsResult,
    invitationsResult,
    companiesResult,
    membershipsResult,
    listingsResult,
    studentsResult,
    deploymentsResult,
    applicationsResult,
    hoursResult,
    logsResult,
  ]) {
    if (!r.ok) return r;
  }

  const departments = departmentsResult.ok ? departmentsResult.data : [];
  const courses = coursesResult.ok ? coursesResult.data : [];
  const batches = batchesResult.ok ? batchesResult.data : [];
  const coordinators = coordinatorsResult.ok ? coordinatorsResult.data : [];
  const invitations = invitationsResult.ok ? invitationsResult.data : [];
  const companies = companiesResult.ok ? companiesResult.data : [];
  const memberships = membershipsResult.ok ? membershipsResult.data : [];
  const listings = listingsResult.ok ? listingsResult.data : [];
  const students = studentsResult.ok ? studentsResult.data : [];
  const deployments = deploymentsResult.ok ? deploymentsResult.data : [];
  const applications = applicationsResult.ok ? applicationsResult.data : [];
  const hours = hoursResult.ok ? hoursResult.data : [];
  const logs = logsResult.ok ? logsResult.data : [];

  // Compute student stages
  const activeDeploymentStudentIds = new Set(
    deployments.filter((d) => d.status === "active").map((d) => d.student_id),
  );
  const completedDeploymentStudentIds = new Set(
    deployments.filter((d) => d.status === "completed").map((d) => d.student_id),
  );
  const applyingStudentIds = new Set(
    applications.filter((a) => a.status === "applied").map((a) => a.student_id),
  );

  let activeDeployments = 0;
  let completedDeployments = 0;
  let applyingStudents = 0;
  let noApplicationStudents = 0;

  for (const s of students) {
    if (activeDeploymentStudentIds.has(s.id)) {
      activeDeployments += 1;
    } else if (completedDeploymentStudentIds.has(s.id)) {
      completedDeployments += 1;
    } else if (applyingStudentIds.has(s.id)) {
      applyingStudents += 1;
    } else {
      noApplicationStudents += 1;
    }
  }

  // Daily logs breakdown
  let pendingEntries = 0;
  let stalePendingEntries = 0;
  let openEntries = 0;

  for (const log of logs) {
    if (log.status === "open") {
      openEntries += 1;
    } else if (log.status === "pending") {
      pendingEntries += 1;
      if (log.log_date <= cutoff) {
        stalePendingEntries += 1;
      }
    }
  }

  // Sum total approved hours
  const totalApprovedHours = Math.round(
    hours.reduce((acc, h) => acc + h.approved_hours, 0) * 10,
  ) / 10;

  // Invitations
  const pendingInvitations = invitations.filter((i) => i.status === "pending");
  const pendingCoordinatorInvitations = pendingInvitations.filter(
    (i) => i.role === "coordinator",
  ).length;
  const pendingSupervisorInvitations = pendingInvitations.filter(
    (i) => i.role === "supervisor",
  ).length;

  const companiesWithOwnerSet = new Set(memberships.map((m) => m.company_id));

  return ok({
    departments: departments.length,
    courses: courses.length,
    batches: batches.length,
    coordinators: new Set(coordinators.map((c) => c.user_id)).size,
    pendingCoordinatorInvitations,
    companies: companies.length,
    companiesWithOwner: companies.filter((c) => companiesWithOwnerSet.has(c.id)).length,
    pendingSupervisorInvitations,

    totalStudents: students.length,
    activeDeployments,
    completedDeployments,
    applyingStudents,
    noApplicationStudents,

    pendingEntries,
    stalePendingEntries,
    openEntries,
    totalApprovedHours,

    activeListings: listings.filter((l) => l.status === "open").length,
    activeCompanies: companies.filter((c) => c.status === "active").length,
  });
}
