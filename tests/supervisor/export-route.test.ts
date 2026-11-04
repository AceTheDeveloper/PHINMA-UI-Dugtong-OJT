import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/roles";
import type { Session } from "@/lib/auth/session";
import { fail, ok } from "@/lib/result";

// The supervisor's CSV route is the only door to the file (ticket-34). The
// session and the read are faked; the CSV is the real one. These tests prove who
// gets the file, that it is read for the session's company only, and that every
// refusal looks the same.

vi.mock("server-only", () => ({}));

const authorize = vi.fn();
vi.mock("@/lib/auth/server", () => ({ authorize: (...args: unknown[]) => authorize(...args) }));

const getCompanyExport = vi.fn();
vi.mock("@/lib/supervisor/export-queries", () => ({
  getCompanyExport: (...args: unknown[]) => getCompanyExport(...args),
}));

const route = await import("@/app/(app)/supervisor/export/route");

function allow(role: Role, over: Partial<Session> = {}) {
  authorize.mockImplementation(async (allowed: readonly Role[]) =>
    allowed.includes(role)
      ? ok({
          userId: "user-1",
          clerkId: "clerk-1",
          role,
          studentId: null,
          courseIds: role === "coordinator" ? ["course-1"] : [],
          companyId: role === "supervisor" ? "company-1" : null,
          isCompanyOwner: false,
          hasConsent: true,
          ...over,
        } satisfies Session)
      : fail("forbidden", "You do not have access to this."),
  );
}

const rows = [
  {
    studentName: "=EVIL()",
    studentNumber: "04-2122-000001",
    courseCode: "BSIT",
    status: "active" as const,
    startedAt: "2026-10-01T01:00:00Z",
    approvedHours: 100,
    requiredHours: 486,
    pendingEntries: 0,
    lastEntryDate: null,
  },
];

beforeEach(() => {
  vi.resetAllMocks();
  getCompanyExport.mockResolvedValue(ok({ companyName: "Northwind, Inc.", rows }));
});

describe("GET /supervisor/export", () => {
  it("gives a supervisor the CSV of their own company, read for the session's company", async () => {
    allow("supervisor");
    const response = await route.GET();
    expect(getCompanyExport).toHaveBeenCalledWith("company-1");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="student-progress-Northwind-Inc-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    // text() would strip the byte-order mark, so look at the raw bytes: EF BB BF.
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes)).toContain(`"'=EVIL()"`);
  });

  it("also gives it to a colleague who is not the owner", async () => {
    allow("supervisor", { isCompanyOwner: false });
    expect((await route.GET()).status).toBe(200);
  });

  it("gives a company with no students only the header row", async () => {
    allow("supervisor");
    getCompanyExport.mockResolvedValue(ok({ companyName: "Northwind", rows: [] }));
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(
      new Uint8Array(await (await route.GET()).arrayBuffer()),
    );
    expect(text.trimEnd().split("\r\n")).toHaveLength(1);
  });

  it.each(["admin", "coordinator", "student"] as const)("refuses a %s with not found", async (role) => {
    allow(role);
    const response = await route.GET();
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
    expect(getCompanyExport).not.toHaveBeenCalled();
  });

  it("tells a signed-out visitor to sign in", async () => {
    authorize.mockResolvedValue(fail("unauthenticated", "Sign in to continue."));
    expect((await route.GET()).status).toBe(401);
    expect(getCompanyExport).not.toHaveBeenCalled();
  });

  it("refuses a supervisor with no company, with the same answer", async () => {
    allow("supervisor", { companyId: null });
    const response = await route.GET();
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
    expect(getCompanyExport).not.toHaveBeenCalled();
  });

  it("answers not found when the company is gone", async () => {
    allow("supervisor");
    getCompanyExport.mockResolvedValue(ok(null));
    expect((await route.GET()).status).toBe(404);
  });

  it("answers 500 without details when the read fails", async () => {
    allow("supervisor");
    getCompanyExport.mockResolvedValue(fail("unexpected", "Something went wrong. Try again in a moment."));
    const response = await route.GET();
    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Something went wrong");
  });
});
