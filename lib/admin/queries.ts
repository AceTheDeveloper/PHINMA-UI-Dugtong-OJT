import "server-only";
import { z } from "zod";
import { adminClient } from "@/lib/db/admin";
import { errorFromDatabase, fail, ok, type Result } from "@/lib/result";

// Reads for the Admin screens. They use the service role, so every caller must
// run requireRole(["admin"]) or authorize(["admin"]) first. Nothing here writes.

const unexpected = "Something went wrong. Try again in a moment.";

async function read<S extends z.ZodType>(
  schema: S,
  run: () => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<Result<z.infer<S>>> {
  const { data, error } = await run();
  if (error) return { ok: false, error: errorFromDatabase(error.message) };
  const parsed = schema.safeParse(data);
  return parsed.success ? ok(parsed.data) : fail("unexpected", unexpected);
}

const db = () => adminClient();

// ---------------------------------------------------------------- academics

const departmentRow = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  is_active: z.boolean(),
});
const courseRow = z.object({
  id: z.string(),
  department_id: z.string(),
  code: z.string(),
  name: z.string(),
  is_active: z.boolean(),
});
const batchRow = z.object({
  id: z.string(),
  course_id: z.string(),
  school_year: z.string(),
  required_hours: z.coerce.number(),
  starts_on: z.string().nullable(),
  ends_on: z.string().nullable(),
  status: z.enum(["planned", "active", "closed"]),
});

export type AcademicsBatch = {
  id: string;
  schoolYear: string;
  requiredHours: number;
  startsOn: string | null;
  endsOn: string | null;
  status: "planned" | "active" | "closed";
};
export type AcademicsCourse = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  batches: AcademicsBatch[];
};
export type AcademicsDepartment = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  courses: AcademicsCourse[];
};

export async function getAcademics(): Promise<Result<AcademicsDepartment[]>> {
  const [departments, courses, batches] = await Promise.all([
    read(z.array(departmentRow), () =>
      db().from("departments").select("id, code, name, is_active").order("code"),
    ),
    read(z.array(courseRow), () =>
      db()
        .from("courses")
        .select("id, department_id, code, name, is_active")
        .order("code"),
    ),
    read(z.array(batchRow), () =>
      db()
        .from("ojt_batches")
        .select("id, course_id, school_year, required_hours, starts_on, ends_on, status")
        .order("school_year", { ascending: false }),
    ),
  ]);
  if (!departments.ok) return departments;
  if (!courses.ok) return courses;
  if (!batches.ok) return batches;

  return ok(
    departments.data.map((department) => ({
      id: department.id,
      code: department.code,
      name: department.name,
      isActive: department.is_active,
      courses: courses.data
        .filter((course) => course.department_id === department.id)
        .map((course) => ({
          id: course.id,
          code: course.code,
          name: course.name,
          isActive: course.is_active,
          batches: batches.data
            .filter((batch) => batch.course_id === course.id)
            .map((batch) => ({
              id: batch.id,
              schoolYear: batch.school_year,
              requiredHours: batch.required_hours,
              startsOn: batch.starts_on,
              endsOn: batch.ends_on,
              status: batch.status,
            })),
        })),
    })),
  );
}

// ---------------------------------------------------------------- companies

const companyRow = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  status: z.enum(["active", "inactive"]),
});
const membershipRow = z.object({
  user_id: z.string(),
  company_id: z.string(),
  is_owner: z.boolean(),
});
const userRow = z.object({
  id: z.string(),
  full_name: z.string(),
  email: z.string(),
  is_active: z.boolean(),
});

export type CompanySummary = {
  id: string;
  name: string;
  address: string | null;
  status: "active" | "inactive";
  supervisorCount: number;
  ownerName: string | null;
  pendingInvitations: number;
};

export async function getCompanies(): Promise<Result<CompanySummary[]>> {
  const [companies, memberships, invitations] = await Promise.all([
    read(z.array(companyRow), () =>
      db().from("companies").select("id, name, address, status").order("name"),
    ),
    read(z.array(membershipRow), () =>
      db().from("supervisor_memberships").select("user_id, company_id, is_owner"),
    ),
    read(z.array(invitationRow), () => invitationQuery().eq("role", "supervisor")),
  ]);
  if (!companies.ok) return companies;
  if (!memberships.ok) return memberships;
  if (!invitations.ok) return invitations;

  const owners = memberships.data.filter((membership) => membership.is_owner);
  const users = await read(z.array(userRow), () =>
    db()
      .from("users")
      .select("id, full_name, email, is_active")
      .in(
        "id",
        owners.length ? owners.map((owner) => owner.user_id) : [noRow],
      ),
  );
  if (!users.ok) return users;

  return ok(
    companies.data.map((company) => {
      const owner = owners.find((membership) => membership.company_id === company.id);
      return {
        id: company.id,
        name: company.name,
        address: company.address,
        status: company.status,
        supervisorCount: memberships.data.filter(
          (membership) => membership.company_id === company.id,
        ).length,
        ownerName: owner
          ? (users.data.find((user) => user.id === owner.user_id)?.full_name ?? null)
          : null,
        pendingInvitations: invitations.data.filter(
          (invitation) =>
            invitation.company_id === company.id && isPending(invitation),
        ).length,
      };
    }),
  );
}

export type CompanyDetail = {
  company: { id: string; name: string; address: string | null; status: "active" | "inactive" };
  supervisors: { userId: string; name: string; email: string; isOwner: boolean; isActive: boolean }[];
  invitations: InvitationSummary[];
  historyRowIds: string[];
};

export async function getCompany(companyId: string): Promise<Result<CompanyDetail | null>> {
  if (!z.string().uuid().safeParse(companyId).success) return ok(null);
  const company = await read(z.array(companyRow), () =>
    db().from("companies").select("id, name, address, status").eq("id", companyId),
  );
  if (!company.ok) return company;
  if (company.data.length === 0) return ok(null);

  const [memberships, invitations] = await Promise.all([
    read(z.array(membershipRow), () =>
      db()
        .from("supervisor_memberships")
        .select("user_id, company_id, is_owner")
        .eq("company_id", companyId),
    ),
    getInvitations({ companyId }),
  ]);
  if (!memberships.ok) return memberships;
  if (!invitations.ok) return invitations;

  const users = await read(z.array(userRow), () =>
    db()
      .from("users")
      .select("id, full_name, email, is_active")
      .in(
        "id",
        memberships.data.length ? memberships.data.map((m) => m.user_id) : [noRow],
      ),
  );
  if (!users.ok) return users;

  const supervisors = memberships.data
    .map((membership) => {
      const user = users.data.find((candidate) => candidate.id === membership.user_id);
      return {
        userId: membership.user_id,
        name: user?.full_name ?? "Unknown",
        email: user?.email ?? "",
        isOwner: membership.is_owner,
        isActive: user?.is_active ?? false,
      };
    })
    .sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || a.name.localeCompare(b.name));

  return ok({
    company: company.data[0],
    supervisors,
    invitations: invitations.data,
    historyRowIds: [
      companyId,
      ...supervisors.map((supervisor) => supervisor.userId),
      ...invitations.data.map((invitation) => invitation.id),
    ],
  });
}

// -------------------------------------------------------------- invitations

// A row id that matches nothing, for .in() filters over an empty list.
const noRow = "00000000-0000-0000-0000-000000000000";

const invitationRow = z.object({
  id: z.string(),
  email: z.string(),
  role: z.enum(["admin", "coordinator", "supervisor", "student"]),
  status: z.enum(["pending", "used", "expired", "revoked"]),
  company_id: z.string().nullable(),
  course_id: z.string().nullable(),
  created_by: z.string().nullable(),
  created_at: z.string(),
  expires_at: z.string(),
  used_at: z.string().nullable(),
});

function invitationQuery() {
  return db()
    .from("invitations")
    .select(
      "id, email, role, status, company_id, course_id, created_by, created_at, expires_at, used_at",
    )
    .order("created_at", { ascending: false });
}

function isPending(invitation: { status: string; expires_at: string }) {
  return invitation.status === "pending" && new Date(invitation.expires_at) > new Date();
}

export type InvitationSummary = {
  id: string;
  email: string;
  role: "admin" | "coordinator" | "supervisor" | "student";
  // "expired" also covers a pending row whose time has run out
  status: "pending" | "used" | "expired" | "revoked";
  target: string | null;
  sentBy: string | null;
  createdAt: string;
  expiresAt: string;
};

export async function getInvitations(
  filter: { companyId?: string; roles?: string[] } = {},
): Promise<Result<InvitationSummary[]>> {
  const [invitations, companies, courses] = await Promise.all([
    read(z.array(invitationRow), () => {
      let query = invitationQuery();
      if (filter.companyId) query = query.eq("company_id", filter.companyId);
      if (filter.roles) query = query.in("role", filter.roles);
      return query;
    }),
    read(z.array(companyRow), () => db().from("companies").select("id, name, address, status")),
    read(z.array(courseRow), () =>
      db().from("courses").select("id, department_id, code, name, is_active"),
    ),
  ]);
  if (!invitations.ok) return invitations;
  if (!companies.ok) return companies;
  if (!courses.ok) return courses;

  const senderIds = [
    ...new Set(invitations.data.flatMap((row) => (row.created_by ? [row.created_by] : []))),
  ];
  const senders = await read(z.array(userRow), () =>
    db()
      .from("users")
      .select("id, full_name, email, is_active")
      .in("id", senderIds.length ? senderIds : [noRow]),
  );
  if (!senders.ok) return senders;

  return ok(
    invitations.data.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      status:
        row.status === "pending" && !isPending(row) ? ("expired" as const) : row.status,
      target:
        companies.data.find((company) => company.id === row.company_id)?.name ??
        courses.data.find((course) => course.id === row.course_id)?.code ??
        null,
      sentBy: senders.data.find((user) => user.id === row.created_by)?.full_name ?? null,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    })),
  );
}

// Used by the revoke action to find the matching Clerk invitation.
export async function getClerkInvitationId(invitationId: string): Promise<Result<string | null>> {
  const found = await read(
    z.array(z.object({ clerk_invitation_id: z.string().nullable() })),
    () => db().from("invitations").select("clerk_invitation_id").eq("id", invitationId),
  );
  if (!found.ok) return found;
  return ok(found.data[0]?.clerk_invitation_id ?? null);
}

// ----------------------------------------------------------------- overview

export type Overview = {
  departments: number;
  courses: number;
  batches: number;
  coordinators: number;
  pendingCoordinatorInvitations: number;
  companies: number;
  companiesWithOwner: number;
  pendingSupervisorInvitations: number;
};

export async function getOverview(): Promise<Result<Overview>> {
  const [academics, companies, coordinatorRows, invitations] = await Promise.all([
    getAcademics(),
    getCompanies(),
    read(z.array(z.object({ user_id: z.string() })), () =>
      db().from("coordinator_assignments").select("user_id"),
    ),
    getInvitations({ roles: ["coordinator", "supervisor"] }),
  ]);
  if (!academics.ok) return academics;
  if (!companies.ok) return companies;
  if (!coordinatorRows.ok) return coordinatorRows;
  if (!invitations.ok) return invitations;

  const courses = academics.data.flatMap((department) => department.courses);
  const pending = invitations.data.filter((invitation) => invitation.status === "pending");
  return ok({
    departments: academics.data.length,
    courses: courses.length,
    batches: courses.reduce((total, course) => total + course.batches.length, 0),
    coordinators: new Set(coordinatorRows.data.map((row) => row.user_id)).size,
    pendingCoordinatorInvitations: pending.filter((i) => i.role === "coordinator").length,
    companies: companies.data.length,
    companiesWithOwner: companies.data.filter((company) => company.ownerName).length,
    pendingSupervisorInvitations: pending.filter((i) => i.role === "supervisor").length,
  });
}

// ---------------------------------------------------------------- audit log

const auditRow = z.object({
  id: z.coerce.string(),
  table_name: z.string(),
  row_id: z.string(),
  action: z.enum(["insert", "update", "delete"]),
  old_value: z.record(z.string(), z.unknown()).nullable(),
  new_value: z.record(z.string(), z.unknown()).nullable(),
  actor_id: z.string().nullable(),
  source: z.enum(["app", "database"]),
  created_at: z.string(),
});

export type AuditEntry = {
  id: string;
  table: string;
  rowId: string;
  action: "insert" | "update" | "delete";
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  actorName: string | null;
  source: "app" | "database";
  createdAt: string;
};

export type AuditQuery = {
  tables?: readonly string[];
  rowIds?: readonly string[];
  actorId?: string;
  from?: string;
  to?: string;
  page?: number;
};

export const auditPageSize = 25;

export async function getAudit(
  filter: AuditQuery = {},
): Promise<Result<{ entries: AuditEntry[]; total: number; page: number }>> {
  const page = Math.max(1, Math.floor(filter.page ?? 1));
  const first = (page - 1) * auditPageSize;

  let query = db()
    .from("audit_log")
    .select(
      "id, table_name, row_id, action, old_value, new_value, actor_id, source, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(first, first + auditPageSize - 1);
  if (filter.tables?.length) query = query.in("table_name", [...filter.tables]);
  if (filter.rowIds) query = query.in("row_id", filter.rowIds.length ? [...filter.rowIds] : [noRow]);
  if (filter.actorId) query = query.eq("actor_id", filter.actorId);
  if (filter.from) query = query.gte("created_at", filter.from);
  if (filter.to) query = query.lt("created_at", filter.to);

  const { data, error, count } = await query;
  if (error) return { ok: false, error: errorFromDatabase(error.message) };
  const rows = z.array(auditRow).safeParse(data);
  if (!rows.success) return fail("unexpected", unexpected);

  const actorIds = [
    ...new Set(rows.data.flatMap((row) => (row.actor_id ? [row.actor_id] : []))),
  ];
  const actors = await read(z.array(userRow), () =>
    db()
      .from("users")
      .select("id, full_name, email, is_active")
      .in("id", actorIds.length ? actorIds : [noRow]),
  );
  if (!actors.ok) return actors;

  return ok({
    total: count ?? rows.data.length,
    page,
    entries: rows.data.map((row) => ({
      id: row.id,
      table: row.table_name,
      rowId: row.row_id,
      action: row.action,
      oldValue: row.old_value,
      newValue: row.new_value,
      actorName: actors.data.find((actor) => actor.id === row.actor_id)?.full_name ?? null,
      source: row.source,
      createdAt: row.created_at,
    })),
  });
}

// People who appear as actors, for the actor filter.
export async function getAuditActors(): Promise<Result<{ id: string; name: string }[]>> {
  const rows = await read(z.array(z.object({ actor_id: z.string().nullable() })), () =>
    db().from("audit_log").select("actor_id").not("actor_id", "is", null).limit(1000),
  );
  if (!rows.ok) return rows;
  const ids = [...new Set(rows.data.flatMap((row) => (row.actor_id ? [row.actor_id] : [])))];
  if (ids.length === 0) return ok([]);
  const users = await read(z.array(userRow), () =>
    db().from("users").select("id, full_name, email, is_active").in("id", ids),
  );
  if (!users.ok) return users;
  return ok(
    users.data
      .map((user) => ({ id: user.id, name: user.full_name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
}
