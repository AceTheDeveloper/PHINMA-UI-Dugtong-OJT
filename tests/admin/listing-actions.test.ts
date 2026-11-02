import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/roles";
import type { Session } from "@/lib/auth/session";
import { fail, ok } from "@/lib/result";

// The three listing actions are shared by the Admin and by a company's own
// supervisors. The session and the database layer are faked; authorize honours
// the role list the action asks for. These tests prove who may call them and
// that a supervisor's company always comes from the session, never the browser.

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const authorize = vi.fn();
vi.mock("@/lib/auth/server", () => ({ authorize: (...args: unknown[]) => authorize(...args) }));

const rpc = {
  createListing: vi.fn(),
  updateListing: vi.fn(),
  setListingStatus: vi.fn(),
};
vi.mock("@/lib/db/rpc", () => rpc);
vi.mock("@/lib/auth/invitations", () => ({ inviteUser: vi.fn(), revokeInvitationEverywhere: vi.fn() }));

const actions = await import("@/app/(app)/admin/actions");

const uuid = "00000000-0000-4000-8000-0000000000aa";
const ownCompany = "00000000-0000-4000-8000-0000000000c1";
const otherCompany = "00000000-0000-4000-8000-0000000000c2";
const userId = "00000000-0000-4000-8000-000000000001";

function session(role: Role, companyId: string | null = null): Session {
  return {
    userId,
    clerkId: "clerk-1",
    role,
    studentId: null,
    courseIds: [],
    companyId,
    isCompanyOwner: false,
    hasConsent: true,
  };
}

function as(role: Role, companyId: string | null = null) {
  authorize.mockImplementation(async (allowed: readonly Role[]) =>
    allowed.includes(role)
      ? ok(session(role, companyId))
      : fail("forbidden", "You do not have access to this."),
  );
}

const newListing = { companyId: otherCompany, title: "Intern", courseIds: [uuid] };

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(rpc)) fn.mockResolvedValue(ok(uuid));
});

describe("listing actions", () => {
  it("ask for admins and supervisors only", async () => {
    as("admin");
    await actions.addListing(newListing);
    expect(authorize).toHaveBeenCalledWith(["admin", "supervisor"]);
  });

  it("use the company from a supervisor's session, ignoring the one in the form", async () => {
    as("supervisor", ownCompany);
    expect((await actions.addListing(newListing)).ok).toBe(true);
    expect(rpc.createListing).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ companyId: ownCompany }),
    );
  });

  it("refuse a supervisor with no company before anything is written", async () => {
    as("supervisor", null);
    expect(await actions.addListing(newListing)).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    expect(rpc.createListing).not.toHaveBeenCalled();
  });

  it("keep the company the admin chose", async () => {
    as("admin");
    await actions.addListing(newListing);
    expect(rpc.createListing).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ companyId: otherCompany }),
    );
  });

  it.each(["coordinator", "student"] as const)("refuse a %s", async (role) => {
    as(role);
    for (const call of [
      () => actions.addListing(newListing),
      () => actions.editListing({ listingId: uuid, title: "Intern", courseIds: [uuid] }),
      () => actions.changeListingStatus({ listingId: uuid, status: "closed" }),
    ]) {
      expect(await call()).toMatchObject({ ok: false, error: { code: "forbidden" } });
    }
    for (const fn of Object.values(rpc)) expect(fn).not.toHaveBeenCalled();
  });

  it("let a supervisor edit and close, with the database deciding the company", async () => {
    as("supervisor", ownCompany);
    expect(
      (await actions.editListing({ listingId: uuid, title: "Intern", courseIds: [uuid] })).ok,
    ).toBe(true);
    expect((await actions.changeListingStatus({ listingId: uuid, status: "closed" })).ok).toBe(true);
    expect(rpc.updateListing).toHaveBeenCalledWith(userId, expect.objectContaining({ listingId: uuid }));
    expect(rpc.setListingStatus).toHaveBeenCalledWith(userId, uuid, "closed");
  });

  it("pass on the database's refusal for another company's listing", async () => {
    as("supervisor", ownCompany);
    rpc.setListingStatus.mockResolvedValue(fail("forbidden", "Only a supervisor of this company can do this."));
    expect(await actions.changeListingStatus({ listingId: uuid, status: "closed" })).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
  });

  it.each([
    ["a listing with no courses", () => actions.addListing({ ...newListing, courseIds: [] })],
    ["a blank title", () => actions.addListing({ ...newListing, title: "  " })],
    ["an invalid status", () => actions.changeListingStatus({ listingId: uuid, status: "archived" })],
  ])("never write %s", async (_label, call) => {
    as("supervisor", ownCompany);
    expect(await call()).toMatchObject({ ok: false, error: { code: "validation" } });
    for (const fn of Object.values(rpc)) expect(fn).not.toHaveBeenCalled();
  });
});
