import "server-only";
import { z } from "zod";
import { adminClient } from "@/lib/db/admin";
import type { Team, TeamInvitation } from "@/lib/supervisor/team";
import { errorFromDatabase, fail, ok, type Result } from "@/lib/result";

// Reads for the supervisor's Team screen (ticket-33). They use the service role,
// so every caller has already run requireRole(["supervisor"]) or
// authorize(["supervisor"]) and passes the company id from the session, never
// an id from the browser. Nothing here writes.

const unexpected = "Something went wrong. Try again in a moment.";
const db = () => adminClient();
// A row id that matches nothing, for .in() filters over an empty list.
const noRow = "00000000-0000-0000-0000-000000000000";

async function read<S extends z.ZodType>(
  schema: S,
  run: () => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<Result<z.infer<S>>> {
  const { data, error } = await run();
  if (error) return { ok: false, error: errorFromDatabase(error.message) };
  const parsed = schema.safeParse(data);
  return parsed.success ? ok(parsed.data) : fail("unexpected", unexpected);
}

const companyRow = z.object({ id: z.string(), name: z.string() });
const membershipRow = z.object({ user_id: z.string(), is_owner: z.boolean() });
const userRow = z.object({
  id: z.string(),
  full_name: z.string(),
  email: z.string(),
  is_active: z.boolean(),
});
const invitationRow = z.object({
  id: z.string(),
  email: z.string(),
  created_at: z.string(),
  expires_at: z.string(),
});

// The company's supervisors and its pending supervisor invitations. Null when
// the company does not exist.
export async function getTeam(companyId: string): Promise<Result<Team | null>> {
  if (!z.string().uuid().safeParse(companyId).success) return ok(null);
  const company = await read(z.array(companyRow), () =>
    db().from("companies").select("id, name").eq("id", companyId),
  );
  if (!company.ok) return company;
  if (company.data.length === 0) return ok(null);

  const [memberships, invitations] = await Promise.all([
    read(z.array(membershipRow), () =>
      db().from("supervisor_memberships").select("user_id, is_owner").eq("company_id", companyId),
    ),
    read(z.array(invitationRow), () =>
      db()
        .from("invitations")
        .select("id, email, created_at, expires_at")
        .eq("company_id", companyId)
        .eq("role", "supervisor")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ),
  ]);
  if (!memberships.ok) return memberships;
  if (!invitations.ok) return invitations;

  const users = await read(z.array(userRow), () =>
    db()
      .from("users")
      .select("id, full_name, email, is_active")
      .in("id", memberships.data.length ? memberships.data.map((m) => m.user_id) : [noRow]),
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
    invitations: invitations.data.map((row) => ({
      id: row.id,
      email: row.email,
      sentAt: row.created_at,
      expiresAt: row.expires_at,
    })),
  });
}

const actionInvitationRow = z.object({
  id: z.string(),
  email: z.string(),
  role: z.enum(["admin", "coordinator", "supervisor", "student"]),
  status: z.enum(["pending", "used", "expired", "revoked"]),
  company_id: z.string().nullable(),
  expires_at: z.string(),
});

// One invitation, for the resend and revoke actions. Null when there is none.
export async function getTeamInvitation(
  invitationId: string,
): Promise<Result<TeamInvitation | null>> {
  if (!z.string().uuid().safeParse(invitationId).success) return ok(null);
  const found = await read(z.array(actionInvitationRow), () =>
    db()
      .from("invitations")
      .select("id, email, role, status, company_id, expires_at")
      .eq("id", invitationId),
  );
  if (!found.ok) return found;
  const row = found.data[0];
  if (!row) return ok(null);
  return ok({
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    companyId: row.company_id,
    expiresAt: row.expires_at,
  });
}

export type InviteeCheck = {
  hasAccount: boolean;
  // A pending invitation to this email, to this company or elsewhere.
  pendingHere: boolean;
  pendingElsewhere: boolean;
  // The company's pending invitations that have not expired.
  livePending: number;
};

// What stands in the way of inviting this email to this company.
export async function checkInvitee(
  email: string,
  companyId: string,
): Promise<Result<InviteeCheck>> {
  const address = email.trim().toLowerCase();
  const [accounts, pendingForEmail, pendingForCompany] = await Promise.all([
    read(z.array(z.object({ id: z.string() })), () =>
      // accounts are stored lowercase (accept_invitation); the database checks
      // again with lower(), so this is only the friendly early answer
      db().from("users").select("id").eq("email", address).limit(1),
    ),
    read(z.array(z.object({ company_id: z.string().nullable() })), () =>
      db().from("invitations").select("company_id").eq("email", address).eq("status", "pending"),
    ),
    read(z.array(z.object({ expires_at: z.string() })), () =>
      db()
        .from("invitations")
        .select("expires_at")
        .eq("company_id", companyId)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString()),
    ),
  ]);
  if (!accounts.ok) return accounts;
  if (!pendingForEmail.ok) return pendingForEmail;
  if (!pendingForCompany.ok) return pendingForCompany;
  return ok({
    hasAccount: accounts.data.length > 0,
    pendingHere: pendingForEmail.data.some((row) => row.company_id === companyId),
    pendingElsewhere: pendingForEmail.data.some((row) => row.company_id !== companyId),
    livePending: pendingForCompany.data.length,
  });
}
