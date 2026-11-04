import { describe, expect, it } from "vitest";
import {
  inviteColleagueSchema,
  teamInvitationSchema,
  teamMessage,
  teamMessages,
  teamView,
  type Team,
} from "@/lib/supervisor/team";

// The Team screen's input rules, its messages, and what the owner and a
// colleague each see (ticket-33).

const owner = "00000000-0000-4000-8000-000000000001";
const colleague = "00000000-0000-4000-8000-000000000002";
const now = new Date("2026-11-04T08:00:00Z");

const team: Team = {
  company: { id: "c1", name: "Northwind" },
  supervisors: [
    { userId: owner, name: "Ana Reyes", email: "ana@northwind.test", isOwner: true, isActive: true },
    { userId: colleague, name: "Ben Cruz", email: "ben@northwind.test", isOwner: false, isActive: true },
  ],
  invitations: [
    { id: "i1", email: "cara@northwind.test", sentAt: "2026-11-01T00:00:00Z", expiresAt: "2026-11-08T00:00:00Z" },
    { id: "i2", email: "dino@northwind.test", sentAt: "2026-10-20T00:00:00Z", expiresAt: "2026-10-27T00:00:00Z" },
  ],
};

describe("inviteColleagueSchema", () => {
  it("accepts an email and trims it", () => {
    expect(inviteColleagueSchema.parse({ email: "  cara@northwind.test " })).toEqual({
      email: "cara@northwind.test",
    });
  });

  it.each([
    ["", "Enter an email address."],
    ["   ", "Enter an email address."],
    ["not-an-email", "Enter a valid email address, like name@company.com."],
    [`${"a".repeat(250)}@x.test`, "That email address is too long, so check it and try again."],
  ])("refuses %j with one sentence", (email, message) => {
    const result = inviteColleagueSchema.safeParse({ email });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe(message);
  });

  it("refuses a missing body with one sentence", () => {
    for (const raw of [undefined, "text", { email: 5 }]) {
      const result = inviteColleagueSchema.safeParse(raw);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0]?.message).toMatch(/^[A-Z][^.]*\.$/);
    }
  });
});

describe("teamInvitationSchema", () => {
  it("needs an invitation id", () => {
    expect(teamInvitationSchema.safeParse({ invitationId: "00000000-0000-4000-8000-0000000000aa" }).success).toBe(true);
    expect(teamInvitationSchema.safeParse({ invitationId: "nope" }).success).toBe(false);
    expect(teamInvitationSchema.safeParse(undefined).success).toBe(false);
  });
});

describe("teamMessages", () => {
  it("are each one sentence that says what to do, with no banned words", () => {
    for (const message of Object.values(teamMessages)) {
      expect(message).toMatch(/^[A-Z][^.]*\.$/);
      expect(message).not.toMatch(/error|please|successfully|click here/i);
    }
  });
});

describe("teamMessage", () => {
  it("puts the database's refusals in the screen's words", () => {
    expect(teamMessage({ code: "conflict", message: "this email already has a Dugtong account" })).toEqual({
      code: "conflict",
      message: teamMessages.hasAccount,
    });
    expect(teamMessage({ code: "conflict", message: "this company already has 10 pending invitations" }).message).toBe(
      teamMessages.atLimit,
    );
    expect(teamMessage({ code: "conflict", message: "a pending invitation already exists for this email" }).message).toBe(
      teamMessages.pendingHere,
    );
    expect(teamMessage({ code: "conflict", message: "invitation is revoked" }).message).toBe(teamMessages.notPending);
    expect(
      teamMessage({ code: "forbidden", message: "only a company owner can invite supervisors to their own company" }),
    ).toEqual({ code: "forbidden", message: teamMessages.notOwner });
  });

  it("passes anything else through", () => {
    const other = { code: "unexpected" as const, message: "The invitation could not be sent. Try again in a moment." };
    expect(teamMessage(other)).toEqual(other);
  });
});

describe("teamView", () => {
  it("gives the owner the controls and marks them as you", () => {
    const view = teamView(team, { userId: owner, isCompanyOwner: true }, now);
    expect(view.canManage).toBe(true);
    expect(view.description).toBe(
      "Supervisors at Northwind. Invite a colleague who signs off on students' days.",
    );
    expect(view.supervisors.map((s) => [s.name, s.isYou])).toEqual([
      ["Ana Reyes", true],
      ["Ben Cruz", false],
    ]);
  });

  it("gives a colleague the same lists, no controls, and the owner to ask", () => {
    const view = teamView(team, { userId: colleague, isCompanyOwner: false }, now);
    expect(view.canManage).toBe(false);
    expect(view.ownerName).toBe("Ana Reyes");
    expect(view.description).toBe("Supervisors at Northwind. Ask Ana Reyes, the owner, to invite a colleague.");
    expect(view.supervisors).toHaveLength(2);
    expect(view.invitations).toHaveLength(2);
  });

  it("does not trust an owner flag that does not match the company's owner", () => {
    expect(teamView(team, { userId: colleague, isCompanyOwner: true }, now).canManage).toBe(false);
  });

  it("points to the admin when the company has no owner", () => {
    const ownerless: Team = { ...team, supervisors: [{ ...team.supervisors[1] }] };
    const view = teamView(ownerless, { userId: colleague, isCompanyOwner: false }, now);
    expect(view.ownerName).toBeNull();
    expect(view.description).toBe("Supervisors at Northwind. Ask the admin to invite a colleague.");
  });

  it("marks expired invitations and counts only live ones toward the limit", () => {
    const view = teamView(team, { userId: owner, isCompanyOwner: true }, now);
    expect(view.invitations.map((i) => [i.email, i.expired])).toEqual([
      ["cara@northwind.test", false],
      ["dino@northwind.test", true],
    ]);
    expect(view.livePending).toBe(1);
    expect(view.atLimit).toBe(false);
  });

  it("says when the company is at 10 live pending invitations", () => {
    const full: Team = {
      ...team,
      invitations: Array.from({ length: 10 }, (_, i) => ({
        id: `i${i}`,
        email: `p${i}@northwind.test`,
        sentAt: "2026-11-01T00:00:00Z",
        expiresAt: "2026-11-08T00:00:00Z",
      })),
    };
    expect(teamView(full, { userId: owner, isCompanyOwner: true }, now).atLimit).toBe(true);
  });
});
