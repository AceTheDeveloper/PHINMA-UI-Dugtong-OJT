import "server-only";
import { z } from "zod";
import { adminClient } from "@/lib/db/admin";
import { roles } from "@/lib/auth/roles";
import { sessionRowSchema } from "@/lib/auth/session-row";
import type { SessionStore } from "@/lib/auth/session";
import { errorFromDatabase, fail, ok, type Result } from "@/lib/result";

// The single place server code calls the database write functions. Every call
// carries the actor id, and the functions re-check role and scope themselves.

async function call(
  name: string,
  args: Record<string, unknown>,
): Promise<Result<unknown>> {
  const { data, error } = await adminClient().rpc(name, args);
  if (error) {
    return { ok: false, error: errorFromDatabase(error.message) };
  }
  const raw: unknown = data;
  return ok(raw);
}

function invalid(message: string): Result<never> {
  return fail("validation", message);
}

const uuid = z.string().uuid();
const idResult = z.string().uuid();

export async function resolveSession(
  clerkId: string,
): Promise<Result<z.infer<typeof sessionRowSchema> | null>> {
  const result = await call("resolve_session", { p_clerk_id: clerkId });
  if (!result.ok) return result;
  const rows = z.array(sessionRowSchema).safeParse(result.data);
  if (!rows.success) return fail("unexpected", "Something went wrong. Try again in a moment.");
  return ok(rows.data[0] ?? null);
}

export async function acceptInvitation(input: {
  clerkId: string;
  email: string;
  fullName: string;
  invitationId: string;
}): Promise<Result<string>> {
  const parsed = z
    .object({
      clerkId: z.string().min(1),
      email: z.string().email(),
      fullName: z.string().min(1),
      invitationId: uuid,
    })
    .safeParse(input);
  if (!parsed.success) return invalid("The invitation details are not valid.");

  const result = await call("accept_invitation", {
    p_clerk_id: parsed.data.clerkId,
    p_email: parsed.data.email,
    p_full_name: parsed.data.fullName,
    p_invitation_id: parsed.data.invitationId,
  });
  if (!result.ok) return result;
  const userId = idResult.safeParse(result.data);
  return userId.success
    ? ok(userId.data)
    : fail("unexpected", "Something went wrong. Try again in a moment.");
}

export async function getConsentNoticeVersion(): Promise<Result<string>> {
  const { data, error } = await adminClient()
    .from("school_settings")
    .select("consent_notice_version")
    .single();
  if (error) return { ok: false, error: errorFromDatabase(error.message) };
  const raw: unknown = data;
  const parsed = z.object({ consent_notice_version: z.string().min(1) }).safeParse(raw);
  return parsed.success
    ? ok(parsed.data.consent_notice_version)
    : fail("unexpected", "Something went wrong. Try again in a moment.");
}

export async function recordConsent(
  userId: string,
  noticeVersion: string,
): Promise<Result<null>> {
  const parsed = z
    .object({ userId: uuid, noticeVersion: z.string().min(1) })
    .safeParse({ userId, noticeVersion });
  if (!parsed.success) return invalid("The consent details are not valid.");
  const result = await call("record_consent", {
    p_user_id: parsed.data.userId,
    p_notice_version: parsed.data.noticeVersion,
  });
  return result.ok ? ok(null) : result;
}

const invitationInput = z.object({
  actorId: uuid,
  role: z.enum(roles),
  email: z.string().email(),
  studentId: uuid.optional(),
  companyId: uuid.optional(),
  courseId: uuid.optional(),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

export async function createInvitation(
  input: z.input<typeof invitationInput>,
): Promise<Result<string>> {
  const parsed = invitationInput.safeParse(input);
  if (!parsed.success) return invalid("The invitation details are not valid.");
  const result = await call("create_invitation", {
    p_actor: parsed.data.actorId,
    p_role: parsed.data.role,
    p_email: parsed.data.email,
    p_student_id: parsed.data.studentId ?? null,
    p_company_id: parsed.data.companyId ?? null,
    p_course_id: parsed.data.courseId ?? null,
    p_expires_in_days: parsed.data.expiresInDays,
  });
  if (!result.ok) return result;
  const created = idResult.safeParse(result.data);
  return created.success
    ? ok(created.data)
    : fail("unexpected", "Something went wrong. Try again in a moment.");
}

export async function setInvitationClerkId(
  actorId: string,
  invitationId: string,
  clerkInvitationId: string,
): Promise<Result<null>> {
  const parsed = z
    .object({ actorId: uuid, invitationId: uuid, clerkInvitationId: z.string().min(1) })
    .safeParse({ actorId, invitationId, clerkInvitationId });
  if (!parsed.success) return invalid("The invitation details are not valid.");
  const result = await call("set_invitation_clerk_id", {
    p_actor: parsed.data.actorId,
    p_invitation_id: parsed.data.invitationId,
    p_clerk_invitation_id: parsed.data.clerkInvitationId,
  });
  return result.ok ? ok(null) : result;
}

export async function revokeInvitation(
  actorId: string,
  invitationId: string,
): Promise<Result<null>> {
  const parsed = z.object({ actorId: uuid, invitationId: uuid }).safeParse({
    actorId,
    invitationId,
  });
  if (!parsed.success) return invalid("The invitation details are not valid.");
  const result = await call("revoke_invitation", {
    p_actor: parsed.data.actorId,
    p_invitation_id: parsed.data.invitationId,
  });
  return result.ok ? ok(null) : result;
}

export async function setUserActive(
  actorId: string,
  userId: string,
  active: boolean,
): Promise<Result<null>> {
  const parsed = z
    .object({ actorId: uuid, userId: uuid, active: z.boolean() })
    .safeParse({ actorId, userId, active });
  if (!parsed.success) return invalid("The account details are not valid.");
  const result = await call("set_user_active", {
    p_actor: parsed.data.actorId,
    p_user_id: parsed.data.userId,
    p_active: parsed.data.active,
  });
  return result.ok ? ok(null) : result;
}

// Admin write functions. Each re-checks that the actor is an active admin.

const unexpected = "Something went wrong. Try again in a moment.";

async function createdId(
  name: string,
  args: Record<string, unknown>,
): Promise<Result<string>> {
  const result = await call(name, args);
  if (!result.ok) return result;
  const created = idResult.safeParse(result.data);
  return created.success ? ok(created.data) : fail("unexpected", unexpected);
}

async function changed(
  name: string,
  args: Record<string, unknown>,
): Promise<Result<null>> {
  const result = await call(name, args);
  return result.ok ? ok(null) : result;
}

export async function createDepartment(
  actorId: string,
  input: { code: string; name: string },
): Promise<Result<string>> {
  const parsed = z
    .object({ actorId: uuid, code: z.string().min(1), name: z.string().min(1) })
    .safeParse({ actorId, ...input });
  if (!parsed.success) return invalid("The department details are not valid.");
  return createdId("create_department", {
    p_actor: parsed.data.actorId,
    p_code: parsed.data.code,
    p_name: parsed.data.name,
  });
}

export async function createCourse(
  actorId: string,
  input: { departmentId: string; code: string; name: string },
): Promise<Result<string>> {
  const parsed = z
    .object({
      actorId: uuid,
      departmentId: uuid,
      code: z.string().min(1),
      name: z.string().min(1),
    })
    .safeParse({ actorId, ...input });
  if (!parsed.success) return invalid("The course details are not valid.");
  return createdId("create_course", {
    p_actor: parsed.data.actorId,
    p_department_id: parsed.data.departmentId,
    p_code: parsed.data.code,
    p_name: parsed.data.name,
  });
}

const optionalIsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

export async function createOjtBatch(
  actorId: string,
  input: {
    courseId: string;
    schoolYear: string;
    requiredHours: number;
    startsOn: string | null;
    endsOn: string | null;
  },
): Promise<Result<string>> {
  const parsed = z
    .object({
      actorId: uuid,
      courseId: uuid,
      schoolYear: z.string().min(1),
      requiredHours: z.number().positive().max(9999.99),
      startsOn: optionalIsoDate,
      endsOn: optionalIsoDate,
    })
    .safeParse({ actorId, ...input });
  if (!parsed.success) return invalid("The batch details are not valid.");
  return createdId("create_ojt_batch", {
    p_actor: parsed.data.actorId,
    p_course_id: parsed.data.courseId,
    p_school_year: parsed.data.schoolYear,
    p_required_hours: parsed.data.requiredHours,
    p_starts_on: parsed.data.startsOn,
    p_ends_on: parsed.data.endsOn,
  });
}

export async function setOjtRequiredHours(
  actorId: string,
  batchId: string,
  requiredHours: number,
): Promise<Result<null>> {
  const parsed = z
    .object({
      actorId: uuid,
      batchId: uuid,
      requiredHours: z.number().positive().max(9999.99),
    })
    .safeParse({ actorId, batchId, requiredHours });
  if (!parsed.success) return invalid("The required hours are not valid.");
  return changed("set_ojt_required_hours", {
    p_actor: parsed.data.actorId,
    p_batch_id: parsed.data.batchId,
    p_required_hours: parsed.data.requiredHours,
  });
}

export async function createCompany(
  actorId: string,
  input: { name: string; address: string | null },
): Promise<Result<string>> {
  const parsed = z
    .object({ actorId: uuid, name: z.string().min(1), address: z.string().nullable() })
    .safeParse({ actorId, ...input });
  if (!parsed.success) return invalid("The company details are not valid.");
  return createdId("create_company", {
    p_actor: parsed.data.actorId,
    p_name: parsed.data.name,
    p_address: parsed.data.address,
  });
}

export async function setCompanyStatus(
  actorId: string,
  companyId: string,
  status: "active" | "inactive",
): Promise<Result<null>> {
  const parsed = z
    .object({ actorId: uuid, companyId: uuid, status: z.enum(["active", "inactive"]) })
    .safeParse({ actorId, companyId, status });
  if (!parsed.success) return invalid("The company details are not valid.");
  return changed("set_company_status", {
    p_actor: parsed.data.actorId,
    p_company_id: parsed.data.companyId,
    p_status: parsed.data.status,
  });
}

export async function importRoster(
  actorId: string,
  batchId: string,
  rows: { row: number; fullName: string; studentNumber: string; email: string }[],
): Promise<Result<number>> {
  const parsed = z
    .object({
      actorId: uuid,
      batchId: uuid,
      rows: z
        .array(
          z.object({
            row: z.number().int().positive(),
            fullName: z.string(),
            studentNumber: z.string(),
            email: z.string(),
          }),
        )
        .min(1)
        .max(1000),
    })
    .safeParse({ actorId, batchId, rows });
  if (!parsed.success) return invalid("The roster is not valid.");
  const result = await call("import_roster", {
    p_actor: parsed.data.actorId,
    p_batch_id: parsed.data.batchId,
    p_rows: parsed.data.rows.map((row) => ({
      row: row.row,
      full_name: row.fullName,
      student_number: row.studentNumber,
      email: row.email,
    })),
  });
  if (!result.ok) return result;
  const count = z.number().int().safeParse(result.data);
  return count.success ? ok(count.data) : fail("unexpected", unexpected);
}

export const databaseSessionStore: SessionStore = {
  resolve: resolveSession,
  accept: acceptInvitation,
};
