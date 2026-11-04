import { beforeEach, describe, expect, it, vi } from "vitest";

// The Team screen's reads are keyed by the company id from the session, so an
// owner never sees another company's supervisors or invitations (ticket-33).
// The database client is faked; what the reads ask for and how they combine
// the answers are checked.

vi.mock("server-only", () => ({}));

type Call = { table: string; filters: [string, unknown][] };
const calls: Call[] = [];
const results: Record<string, unknown> = {};
// Answers for one table in call order, used before results[table].
const queued: Record<string, unknown[]> = {};

function builder(table: string) {
  const call: Call = { table, filters: [] };
  calls.push(call);
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = self;
  chain.order = self;
  chain.limit = self;
  const filter = (name: string) => (column: string, value: unknown) => {
    call.filters.push([`${name}:${column}`, value]);
    return chain;
  };
  chain.eq = filter("eq");
  chain.gt = filter("gt");
  chain.in = filter("in");
  chain.then = (resolve: (value: unknown) => unknown) =>
    resolve({ data: queued[table]?.shift() ?? results[table] ?? [], error: null });
  return chain;
}

vi.mock("@/lib/db/admin", () => ({ adminClient: () => ({ from: builder }) }));

const queries = await import("@/lib/supervisor/team-queries");

const companyId = "00000000-0000-4000-8000-0000000000c1";
const invitationId = "00000000-0000-4000-8000-0000000000aa";

beforeEach(() => {
  calls.length = 0;
  for (const key of Object.keys(results)) delete results[key];
  for (const key of Object.keys(queued)) delete queued[key];
});

const callsTo = (table: string) => calls.filter((call) => call.table === table);

describe("getTeam", () => {
  beforeEach(() => {
    results.companies = [{ id: companyId, name: "Northwind" }];
    results.supervisor_memberships = [
      { user_id: "u2", is_owner: false },
      { user_id: "u1", is_owner: true },
    ];
    results.users = [
      { id: "u1", full_name: "Ana Reyes", email: "ana@northwind.test", is_active: true },
      { id: "u2", full_name: "Ben Cruz", email: "ben@northwind.test", is_active: false },
    ];
    results.invitations = [
      { id: "i1", email: "cara@northwind.test", created_at: "2026-11-01T00:00:00Z", expires_at: "2026-11-08T00:00:00Z" },
    ];
  });

  it("reads only the session's company, its memberships, and its pending supervisor invitations", async () => {
    await queries.getTeam(companyId);
    expect(callsTo("companies")[0].filters).toEqual([["eq:id", companyId]]);
    expect(callsTo("supervisor_memberships")[0].filters).toEqual([["eq:company_id", companyId]]);
    expect(callsTo("invitations")[0].filters).toEqual([
      ["eq:company_id", companyId],
      ["eq:role", "supervisor"],
      ["eq:status", "pending"],
    ]);
    expect(callsTo("users")[0].filters).toEqual([["in:id", ["u2", "u1"]]]);
  });

  it("lists the owner first, with each supervisor's name, email, and status", async () => {
    const result = await queries.getTeam(companyId);
    expect(result).toEqual({
      ok: true,
      data: {
        company: { id: companyId, name: "Northwind" },
        supervisors: [
          { userId: "u1", name: "Ana Reyes", email: "ana@northwind.test", isOwner: true, isActive: true },
          { userId: "u2", name: "Ben Cruz", email: "ben@northwind.test", isOwner: false, isActive: false },
        ],
        invitations: [
          { id: "i1", email: "cara@northwind.test", sentAt: "2026-11-01T00:00:00Z", expiresAt: "2026-11-08T00:00:00Z" },
        ],
      },
    });
  });

  it("returns null for a company that does not exist, or a malformed id", async () => {
    results.companies = [];
    expect(await queries.getTeam(companyId)).toEqual({ ok: true, data: null });
    calls.length = 0;
    expect(await queries.getTeam("nope")).toEqual({ ok: true, data: null });
    expect(calls).toHaveLength(0);
  });
});

describe("getTeamInvitation", () => {
  it("reads one invitation by id with its company", async () => {
    results.invitations = [
      {
        id: invitationId,
        email: "cara@northwind.test",
        role: "supervisor",
        status: "pending",
        company_id: companyId,
        expires_at: "2026-11-08T00:00:00Z",
      },
    ];
    expect(await queries.getTeamInvitation(invitationId)).toEqual({
      ok: true,
      data: {
        id: invitationId,
        email: "cara@northwind.test",
        role: "supervisor",
        status: "pending",
        companyId,
        expiresAt: "2026-11-08T00:00:00Z",
      },
    });
    expect(callsTo("invitations")[0].filters).toEqual([["eq:id", invitationId]]);
  });

  it("returns null for a missing or malformed id", async () => {
    expect(await queries.getTeamInvitation(invitationId)).toEqual({ ok: true, data: null });
    calls.length = 0;
    expect(await queries.getTeamInvitation("nope")).toEqual({ ok: true, data: null });
    expect(calls).toHaveLength(0);
  });
});

describe("checkInvitee", () => {
  it("looks the email up lowercased and counts the company's live pending invitations", async () => {
    queued.users = [[]];
    queued.invitations = [[{ company_id: companyId }], [{ expires_at: "x" }, { expires_at: "y" }]];
    expect(await queries.checkInvitee(" Cara@Northwind.TEST ", companyId)).toEqual({
      ok: true,
      data: { hasAccount: false, pendingHere: true, pendingElsewhere: false, livePending: 2 },
    });
    expect(callsTo("users")[0].filters).toEqual([["eq:email", "cara@northwind.test"]]);
    const [forEmail, forCompany] = callsTo("invitations");
    expect(forEmail.filters).toEqual([
      ["eq:email", "cara@northwind.test"],
      ["eq:status", "pending"],
    ]);
    expect(forCompany.filters.slice(0, 2)).toEqual([
      ["eq:company_id", companyId],
      ["eq:status", "pending"],
    ]);
    expect(forCompany.filters[2][0]).toBe("gt:expires_at");
  });

  it("tells an existing account and a pending invitation elsewhere apart", async () => {
    queued.users = [[{ id: "u9" }]];
    queued.invitations = [[{ company_id: "another" }], []];
    expect(await queries.checkInvitee("x@y.test", companyId)).toEqual({
      ok: true,
      data: { hasAccount: true, pendingHere: false, pendingElsewhere: true, livePending: 0 },
    });
  });
});
