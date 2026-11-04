"use server";

import { revalidatePath } from "next/cache";
import { inviteUser, revokeInvitationEverywhere } from "@/lib/auth/invitations";
import { isCompanyOwner } from "@/lib/auth/scope";
import { authorize } from "@/lib/auth/server";
import type { Session } from "@/lib/auth/session";
import {
  inviteColleagueSchema,
  maxPendingInvitations,
  teamInvitationSchema,
  teamMessage,
  teamMessages,
  type TeamInvitation,
} from "@/lib/supervisor/team";
import { checkInvitee, getTeamInvitation } from "@/lib/supervisor/team-queries";
import { fail, ok, type AppError, type Result } from "@/lib/result";

// A company owner invites colleague supervisors and manages their company's
// pending invitations (AGENTS.md section 4, ticket-33). Every action checks the
// caller is a supervisor who owns their company, validates the input, and keeps
// to that company; the company always comes from the session, never from the
// browser. The database checks ownership again.

type OwnerSession = Session & { companyId: string };

async function ownerSession(): Promise<Result<OwnerSession>> {
  const session = await authorize(["supervisor"]);
  if (!session.ok) return session;
  const { companyId } = session.data;
  if (!companyId) return fail("forbidden", teamMessages.noCompany);
  if (!isCompanyOwner(session.data, companyId)) return fail("forbidden", teamMessages.notOwner);
  return ok({ ...session.data, companyId });
}

// The invitation, if it is a pending supervisor invitation to the owner's own
// company. Another company's invitation is "not found", so ids cannot be probed.
async function pendingInvitationOf(
  session: OwnerSession,
  invitationId: string,
): Promise<Result<TeamInvitation>> {
  const found = await getTeamInvitation(invitationId);
  if (!found.ok) return found;
  const invitation = found.data;
  if (!invitation || invitation.role !== "supervisor" || invitation.companyId !== session.companyId) {
    return fail("not_found", teamMessages.notFound);
  }
  if (invitation.status !== "pending") return fail("conflict", teamMessages.notPending);
  return ok(invitation);
}

function refresh() {
  revalidatePath("/supervisor/team");
  revalidatePath("/admin/companies", "layout");
  revalidatePath("/admin/people");
  revalidatePath("/admin/audit");
}

// A refusal from the database or Clerk, in this screen's own words.
function failed(error: AppError): Result<never> {
  const mapped = teamMessage(error);
  return fail(mapped.code, mapped.message);
}

export async function inviteColleagueAction(raw: unknown): Promise<Result<null>> {
  const session = await ownerSession();
  if (!session.ok) return session;
  const input = inviteColleagueSchema.safeParse(raw);
  if (!input.success) {
    return fail("validation", input.error.issues[0]?.message ?? "Enter an email address.");
  }

  const check = await checkInvitee(input.data.email, session.data.companyId);
  if (!check.ok) return check;
  if (check.data.hasAccount) return fail("conflict", teamMessages.hasAccount);
  if (check.data.pendingHere) return fail("conflict", teamMessages.pendingHere);
  if (check.data.pendingElsewhere) return fail("conflict", teamMessages.pendingElsewhere);
  if (check.data.livePending >= maxPendingInvitations) {
    return fail("conflict", teamMessages.atLimit);
  }

  const sent = await inviteUser({
    actorId: session.data.userId,
    role: "supervisor",
    email: input.data.email,
    companyId: session.data.companyId,
  });
  if (!sent.ok) return failed(sent.error);
  refresh();
  return ok(null);
}

// Replaces a pending invitation with a new one, for example after the link
// expired or the email went to spam.
export async function resendColleagueInvitationAction(raw: unknown): Promise<Result<null>> {
  const session = await ownerSession();
  if (!session.ok) return session;
  const input = teamInvitationSchema.safeParse(raw);
  if (!input.success) {
    return fail("validation", input.error.issues[0]?.message ?? teamMessages.notFound);
  }
  const invitation = await pendingInvitationOf(session.data, input.data.invitationId);
  if (!invitation.ok) return invitation;

  const check = await checkInvitee(invitation.data.email, session.data.companyId);
  if (!check.ok) return check;
  if (check.data.hasAccount) return fail("conflict", teamMessages.hasAccount);
  // Resending an expired invitation adds a live one; check the limit before
  // the old one is revoked, so a refusal leaves everything as it was.
  const expired = new Date(invitation.data.expiresAt).getTime() <= Date.now();
  if (expired && check.data.livePending >= maxPendingInvitations) {
    return fail("conflict", teamMessages.atLimit);
  }

  const revoked = await revokeInvitationEverywhere(session.data.userId, invitation.data.id);
  if (!revoked.ok) return failed(revoked.error);
  const sent = await inviteUser({
    actorId: session.data.userId,
    role: "supervisor",
    email: invitation.data.email,
    companyId: session.data.companyId,
  });
  refresh();
  if (!sent.ok) return failed(sent.error);
  return ok(null);
}

export async function revokeColleagueInvitationAction(raw: unknown): Promise<Result<null>> {
  const session = await ownerSession();
  if (!session.ok) return session;
  const input = teamInvitationSchema.safeParse(raw);
  if (!input.success) {
    return fail("validation", input.error.issues[0]?.message ?? teamMessages.notFound);
  }
  const invitation = await pendingInvitationOf(session.data, input.data.invitationId);
  if (!invitation.ok) return invitation;

  const revoked = await revokeInvitationEverywhere(session.data.userId, invitation.data.id);
  if (!revoked.ok) return failed(revoked.error);
  refresh();
  return ok(null);
}
