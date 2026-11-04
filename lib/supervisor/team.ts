import { z } from "zod";
import type { AppError } from "@/lib/result";

// The supervisor's Team screen (ticket-33): the shapes it shows, the input
// rules shared by the forms and the server actions, the one-sentence messages,
// and what the owner and a colleague each see.

export const maxPendingInvitations = 10;

export type TeamSupervisor = {
  userId: string;
  name: string;
  email: string;
  isOwner: boolean;
  isActive: boolean;
};

export type TeamPendingInvitation = {
  id: string;
  email: string;
  sentAt: string;
  expiresAt: string;
};

export type Team = {
  company: { id: string; name: string };
  supervisors: TeamSupervisor[];
  invitations: TeamPendingInvitation[];
};

export type TeamInvitation = {
  id: string;
  email: string;
  role: "admin" | "coordinator" | "supervisor" | "student";
  status: "pending" | "used" | "expired" | "revoked";
  companyId: string | null;
  expiresAt: string;
};

const reload = "The page is out of date, so reload it and try again.";

export const inviteColleagueSchema = z.object(
  {
    email: z
      .string("Enter an email address.")
      .trim()
      .min(1, "Enter an email address.")
      .max(254, "That email address is too long, so check it and try again.")
      .email("Enter a valid email address, like name@company.com."),
  },
  reload,
);

export const teamInvitationSchema = z.object(
  { invitationId: z.string(reload).uuid(reload) },
  reload,
);

export type InviteColleagueInput = z.infer<typeof inviteColleagueSchema>;

export const teamMessages = {
  noCompany: "This account has no company, so contact the admin.",
  notOwner: "Only your company's owner can manage invitations, so ask them to do it.",
  hasAccount: "This email already has a Dugtong account, so ask the admin to help.",
  pendingHere: "This email already has a pending invitation, so resend it from the list instead.",
  pendingElsewhere:
    "This email already has a pending invitation from another company, so ask the admin to help.",
  atLimit: `Your company has ${maxPendingInvitations} pending invitations, so revoke one before inviting another.`,
  notFound: "That invitation was not found, so reload the page.",
  notPending: "That invitation was already used or revoked, so reload the page.",
} as const;

// The database speaks in lowercase codes ("conflict: ..."); turn the ones this
// screen can meet into its own sentences. Anything else passes through.
export function teamMessage(error: AppError): AppError {
  const text = error.message.toLowerCase();
  if (error.code === "conflict" && text.includes("dugtong account")) {
    return { code: "conflict", message: teamMessages.hasAccount };
  }
  if (error.code === "conflict" && text.includes("pending invitations")) {
    return { code: "conflict", message: teamMessages.atLimit };
  }
  if (error.code === "conflict" && text.includes("pending invitation already exists")) {
    return { code: "conflict", message: teamMessages.pendingHere };
  }
  if (error.code === "conflict" && text.startsWith("invitation is")) {
    return { code: "conflict", message: teamMessages.notPending };
  }
  if (error.code === "forbidden") {
    return { code: "forbidden", message: teamMessages.notOwner };
  }
  return error;
}

export type TeamViewInvitation = TeamPendingInvitation & { expired: boolean };

export type TeamView = {
  companyName: string;
  canManage: boolean;
  ownerName: string | null;
  description: string;
  supervisors: (TeamSupervisor & { isYou: boolean })[];
  invitations: TeamViewInvitation[];
  livePending: number;
  atLimit: boolean;
};

// What the page shows. Only the owner gets the invite, resend, and revoke
// controls; a colleague sees the same lists and who to ask.
export function teamView(
  team: Team,
  viewer: { userId: string; isCompanyOwner: boolean },
  now: Date,
): TeamView {
  const owner = team.supervisors.find((supervisor) => supervisor.isOwner) ?? null;
  const canManage = viewer.isCompanyOwner && owner?.userId === viewer.userId;
  const invitations = team.invitations.map((invitation) => ({
    ...invitation,
    expired: new Date(invitation.expiresAt).getTime() <= now.getTime(),
  }));
  const livePending = invitations.filter((invitation) => !invitation.expired).length;

  let description: string;
  if (canManage) {
    description = `Supervisors at ${team.company.name}. Invite a colleague who signs off on students' days.`;
  } else if (owner) {
    description = `Supervisors at ${team.company.name}. Ask ${owner.name}, the owner, to invite a colleague.`;
  } else {
    description = `Supervisors at ${team.company.name}. Ask the admin to invite a colleague.`;
  }

  return {
    companyName: team.company.name,
    canManage,
    ownerName: owner?.name ?? null,
    description,
    supervisors: team.supervisors.map((supervisor) => ({
      ...supervisor,
      isYou: supervisor.userId === viewer.userId,
    })),
    invitations,
    livePending,
    atLimit: livePending >= maxPendingInvitations,
  };
}
