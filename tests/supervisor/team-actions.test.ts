import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/roles";
import type { Session } from "@/lib/auth/session";
import { fail, ok } from "@/lib/result";
import { teamMessages } from "@/lib/supervisor/team";

// The Team screen's actions are the only door the owner's controls write
// through (ticket-33). The session, the reads, and the invitation helpers are
// faked. These tests prove only the owner may call them, that they keep to the
// owner's own company (another company's invitation is "not found"), that the
// refusals are one sentence, and that bad input never reaches the database.

vi.mock("server-only", () => ({}));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

const authorize = vi.fn();
vi.mock("@/lib/auth/server", () => ({ authorize: (...args: unknown[]) => authorize(...args) }));

const invitations = { inviteUser: vi.fn(), revokeInvitationEverywhere: vi.fn() };
vi.mock("@/lib/auth/invitations", () => invitations);

const queries = { checkInvitee: vi.fn(), getTeamInvitation: vi.fn() };
vi.mock("@/lib/supervisor/team-queries", () => queries);

const actions = await import("@/app/(app)/supervisor/team/actions");

const userId = "00000000-0000-4000-8000-000000000001";
const companyId = "00000000-0000-4000-8000-0000000000c1";
const otherCompanyId = "00000000-0000-4000-8000-0000000000c2";
const invitationId = "00000000-0000-4000-8000-0000000000aa";
const future = "2099-01-01T00:00:00Z";
const past = "2020-01-01T00:00:00Z";

function signIn(role: Role, over: Partial<Session> = {}) {
  authorize.mockImplementation(async (allowed: readonly Role[]) =>
    allowed.includes(role)
      ? ok({
          userId,
          clerkId: "clerk-1",
          role,
          studentId: null,
          courseIds: [],
          companyId: role === "supervisor" ? companyId : null,
          isCompanyOwner: role === "supervisor",
          hasConsent: true,
          ...over,
        } satisfies Session)
      : fail("forbidden", "You do not have access to this."),
  );
}

const clear = { hasAccount: false, pendingHere: false, pendingElsewhere: false, livePending: 0 };
const pendingInvitation = {
  id: invitationId,
  email: "cara@northwind.test",
  role: "supervisor",
  status: "pending",
  companyId,
  expiresAt: future,
};

beforeEach(() => {
  vi.resetAllMocks();
  queries.checkInvitee.mockResolvedValue(ok(clear));
  queries.getTeamInvitation.mockResolvedValue(ok(pendingInvitation));
  invitations.inviteUser.mockResolvedValue(ok("new-invitation"));
  invitations.revokeInvitationEverywhere.mockResolvedValue(ok(null));
});

const all = [
  ["inviteColleagueAction", () => actions.inviteColleagueAction({ email: "cara@northwind.test" })],
  ["resendColleagueInvitationAction", () => actions.resendColleagueInvitationAction({ invitationId })],
  ["revokeColleagueInvitationAction", () => actions.revokeColleagueInvitationAction({ invitationId })],
] as const;

describe("who may call the Team actions", () => {
  for (const [name, run] of all) {
    it.each(["admin", "coordinator", "student"] as const)(`${name} refuses a %s`, async (role) => {
      signIn(role);
      expect(await run()).toMatchObject({ ok: false, error: { code: "forbidden" } });
      expect(invitations.inviteUser).not.toHaveBeenCalled();
      expect(invitations.revokeInvitationEverywhere).not.toHaveBeenCalled();
    });

    it(`${name} refuses a signed-out visitor`, async () => {
      authorize.mockResolvedValue(fail("unauthenticated", "Sign in to continue."));
      expect(await run()).toMatchObject({ ok: false, error: { code: "unauthenticated" } });
      expect(invitations.inviteUser).not.toHaveBeenCalled();
    });

    it(`${name} refuses a supervisor who is not the owner, on the server`, async () => {
      signIn("supervisor", { isCompanyOwner: false });
      expect(await run()).toEqual({
        ok: false,
        error: { code: "forbidden", message: teamMessages.notOwner },
      });
      expect(queries.getTeamInvitation).not.toHaveBeenCalled();
      expect(invitations.inviteUser).not.toHaveBeenCalled();
      expect(invitations.revokeInvitationEverywhere).not.toHaveBeenCalled();
    });

    it(`${name} refuses a supervisor with no company`, async () => {
      signIn("supervisor", { companyId: null });
      expect(await run()).toEqual({
        ok: false,
        error: { code: "forbidden", message: teamMessages.noCompany },
      });
    });
  }
});

describe("inviteColleagueAction", () => {
  it("invites a supervisor to the owner's own company, from the session", async () => {
    signIn("supervisor");
    expect(
      await actions.inviteColleagueAction({ email: " cara@northwind.test ", companyId: otherCompanyId }),
    ).toEqual({ ok: true, data: null });
    expect(queries.checkInvitee).toHaveBeenCalledWith("cara@northwind.test", companyId);
    expect(invitations.inviteUser).toHaveBeenCalledWith({
      actorId: userId,
      role: "supervisor",
      email: "cara@northwind.test",
      companyId,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/supervisor/team");
  });

  it.each([
    ["an email with an account", { hasAccount: true }, teamMessages.hasAccount],
    ["an email with a pending invitation here", { pendingHere: true }, teamMessages.pendingHere],
    ["an email with a pending invitation elsewhere", { pendingElsewhere: true }, teamMessages.pendingElsewhere],
    ["a company at 10 pending invitations", { livePending: 10 }, teamMessages.atLimit],
  ])("refuses %s with one sentence", async (_label, over, message) => {
    signIn("supervisor");
    queries.checkInvitee.mockResolvedValue(ok({ ...clear, ...over }));
    expect(await actions.inviteColleagueAction({ email: "cara@northwind.test" })).toEqual({
      ok: false,
      error: { code: "conflict", message },
    });
    expect(invitations.inviteUser).not.toHaveBeenCalled();
  });

  it("allows nine pending invitations", async () => {
    signIn("supervisor");
    queries.checkInvitee.mockResolvedValue(ok({ ...clear, livePending: 9 }));
    expect(await actions.inviteColleagueAction({ email: "cara@northwind.test" })).toEqual({ ok: true, data: null });
  });

  it.each([
    ["nothing", undefined],
    ["text", "text"],
    ["an empty email", { email: "" }],
    ["a bad email", { email: "cara" }],
  ])("refuses %s without touching the database", async (_label, raw) => {
    signIn("supervisor");
    const result = await actions.inviteColleagueAction(raw);
    expect(result).toMatchObject({ ok: false, error: { code: "validation" } });
    expect(queries.checkInvitee).not.toHaveBeenCalled();
    expect(invitations.inviteUser).not.toHaveBeenCalled();
  });

  it("puts a database refusal in the screen's words and does not refresh", async () => {
    signIn("supervisor");
    invitations.inviteUser.mockResolvedValue(fail("conflict", "this email already has a Dugtong account"));
    expect(await actions.inviteColleagueAction({ email: "cara@northwind.test" })).toEqual({
      ok: false,
      error: { code: "conflict", message: teamMessages.hasAccount },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("resendColleagueInvitationAction", () => {
  it("revokes the pending invitation and sends a new one to the same email", async () => {
    signIn("supervisor");
    expect(await actions.resendColleagueInvitationAction({ invitationId })).toEqual({ ok: true, data: null });
    expect(invitations.revokeInvitationEverywhere).toHaveBeenCalledWith(userId, invitationId);
    expect(invitations.inviteUser).toHaveBeenCalledWith({
      actorId: userId,
      role: "supervisor",
      email: "cara@northwind.test",
      companyId,
    });
  });

  it("resends an expired invitation", async () => {
    signIn("supervisor");
    queries.getTeamInvitation.mockResolvedValue(ok({ ...pendingInvitation, expiresAt: past }));
    expect(await actions.resendColleagueInvitationAction({ invitationId })).toEqual({ ok: true, data: null });
  });

  it("refuses an expired one at the limit before revoking anything", async () => {
    signIn("supervisor");
    queries.getTeamInvitation.mockResolvedValue(ok({ ...pendingInvitation, expiresAt: past }));
    queries.checkInvitee.mockResolvedValue(ok({ ...clear, livePending: 10 }));
    expect(await actions.resendColleagueInvitationAction({ invitationId })).toEqual({
      ok: false,
      error: { code: "conflict", message: teamMessages.atLimit },
    });
    expect(invitations.revokeInvitationEverywhere).not.toHaveBeenCalled();
  });

  it("resends a live one even at the limit, since it replaces itself", async () => {
    signIn("supervisor");
    queries.checkInvitee.mockResolvedValue(ok({ ...clear, livePending: 10 }));
    expect(await actions.resendColleagueInvitationAction({ invitationId })).toEqual({ ok: true, data: null });
  });

  it("refuses when the invitee has since made an account", async () => {
    signIn("supervisor");
    queries.checkInvitee.mockResolvedValue(ok({ ...clear, hasAccount: true }));
    expect(await actions.resendColleagueInvitationAction({ invitationId })).toMatchObject({
      ok: false,
      error: { message: teamMessages.hasAccount },
    });
    expect(invitations.revokeInvitationEverywhere).not.toHaveBeenCalled();
  });
});

describe("invitation scope (resend and revoke)", () => {
  const scoped = [
    ["resend", () => actions.resendColleagueInvitationAction({ invitationId })],
    ["revoke", () => actions.revokeColleagueInvitationAction({ invitationId })],
  ] as const;

  for (const [name, run] of scoped) {
    it(`${name}: another company's invitation is not found`, async () => {
      signIn("supervisor");
      queries.getTeamInvitation.mockResolvedValue(ok({ ...pendingInvitation, companyId: otherCompanyId }));
      expect(await run()).toEqual({ ok: false, error: { code: "not_found", message: teamMessages.notFound } });
      expect(invitations.revokeInvitationEverywhere).not.toHaveBeenCalled();
    });

    it(`${name}: a missing invitation is not found`, async () => {
      signIn("supervisor");
      queries.getTeamInvitation.mockResolvedValue(ok(null));
      expect(await run()).toMatchObject({ ok: false, error: { code: "not_found" } });
    });

    it(`${name}: an invitation of another role is not found`, async () => {
      signIn("supervisor");
      queries.getTeamInvitation.mockResolvedValue(ok({ ...pendingInvitation, role: "student", companyId: null }));
      expect(await run()).toMatchObject({ ok: false, error: { code: "not_found" } });
    });

    it(`${name}: a used or revoked invitation is refused`, async () => {
      signIn("supervisor");
      queries.getTeamInvitation.mockResolvedValue(ok({ ...pendingInvitation, status: "used" }));
      expect(await run()).toEqual({ ok: false, error: { code: "conflict", message: teamMessages.notPending } });
      expect(invitations.revokeInvitationEverywhere).not.toHaveBeenCalled();
    });

    it(`${name}: a bad id never reaches the database`, async () => {
      signIn("supervisor");
      expect(
        name === "resend"
          ? await actions.resendColleagueInvitationAction({ invitationId: "nope" })
          : await actions.revokeColleagueInvitationAction({ invitationId: "nope" }),
      ).toMatchObject({ ok: false, error: { code: "validation" } });
      expect(queries.getTeamInvitation).not.toHaveBeenCalled();
    });
  }

  it("revoke: revokes in the database and Clerk, then refreshes", async () => {
    signIn("supervisor");
    expect(await actions.revokeColleagueInvitationAction({ invitationId })).toEqual({ ok: true, data: null });
    expect(invitations.revokeInvitationEverywhere).toHaveBeenCalledWith(userId, invitationId);
    expect(revalidatePath).toHaveBeenCalledWith("/supervisor/team");
  });
});
