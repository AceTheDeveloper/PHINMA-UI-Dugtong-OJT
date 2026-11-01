import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { fail, ok, type Result } from "@/lib/result";
import {
  createInvitation,
  revokeInvitation,
  setInvitationClerkId,
} from "@/lib/db/rpc";

const lifetimeDays = 7;

// Sends an invitation: the database row first (it decides who may invite
// whom), then the Clerk invitation that emails the link. If Clerk fails, the
// row is revoked so no orphan invitation is left pending.
export async function inviteUser(
  input: Parameters<typeof createInvitation>[0],
): Promise<Result<string>> {
  const appUrl = z.string().url().safeParse(process.env.NEXT_PUBLIC_APP_URL);
  if (!appUrl.success) {
    return fail("unexpected", "Something went wrong. Try again in a moment.");
  }

  const created = await createInvitation({ ...input, expiresInDays: lifetimeDays });
  if (!created.ok) return created;
  const invitationId = created.data;

  try {
    const client = await clerkClient();
    const invitation = await client.invitations.createInvitation({
      emailAddress: input.email,
      publicMetadata: { invitation_id: invitationId },
      redirectUrl: `${appUrl.data.replace(/\/$/, "")}/accept-invitation`,
      expiresInDays: lifetimeDays,
    });
    const attached = await setInvitationClerkId(input.actorId, invitationId, invitation.id);
    if (!attached.ok) throw new Error(attached.error.message);
  } catch {
    await revokeInvitation(input.actorId, invitationId);
    return fail("unexpected", "The invitation could not be sent. Try again in a moment.");
  }
  return ok(invitationId);
}
