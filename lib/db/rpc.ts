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

export const databaseSessionStore: SessionStore = {
  resolve: resolveSession,
  accept: acceptInvitation,
};
