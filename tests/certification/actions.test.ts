import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/roles";
import type { Session } from "@/lib/auth/session";
import { fail, ok } from "@/lib/result";

// The save-signatories action is the only door the coordinator's form writes
// through. The session and the database layer are faked. These tests prove who
// may call it (the admin may not), that a coordinator can only change their own
// course, that bad input never reaches the database, and that the database's
// refusals come back as typed results.

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const authorize = vi.fn();
vi.mock("@/lib/auth/server", () => ({ authorize: (...args: unknown[]) => authorize(...args) }));

const rpc = { saveCertificateTemplate: vi.fn() };
vi.mock("@/lib/db/rpc", () => rpc);

const { saveTemplateAction } = await import("@/app/(app)/coordinator/certifications/actions");

const userId = "00000000-0000-4000-8000-000000000001";
const courseId = "00000000-0000-4000-8000-0000000000c1";
const otherCourseId = "00000000-0000-4000-8000-0000000000c2";

const valid = {
  courseId,
  signatory1Name: "Dr. Ana Reyes",
  signatory1Title: "OJT Coordinator",
  signatory2Name: "Prof. Ben Santos",
  signatory2Title: "Dean",
};

function allow(role: Role) {
  authorize.mockImplementation(async (allowed: readonly Role[]) =>
    allowed.includes(role)
      ? ok({
          userId,
          clerkId: "clerk-1",
          role,
          studentId: null,
          courseIds: role === "coordinator" ? [courseId] : [],
          companyId: null,
          isCompanyOwner: false,
          hasConsent: true,
        } satisfies Session)
      : fail("forbidden", "You do not have access to this."),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  rpc.saveCertificateTemplate.mockResolvedValue(ok(null));
});

describe("saveTemplateAction", () => {
  it("saves as the session coordinator, trimming the text", async () => {
    allow("coordinator");
    expect(
      await saveTemplateAction({ ...valid, signatory1Name: "  Dr. Ana Reyes  " }),
    ).toEqual({ ok: true, data: null });
    expect(rpc.saveCertificateTemplate).toHaveBeenCalledWith(userId, valid);
  });

  it.each(["admin", "supervisor", "student"] as const)("refuses a %s", async (role) => {
    allow(role);
    expect(await saveTemplateAction(valid)).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(rpc.saveCertificateTemplate).not.toHaveBeenCalled();
  });

  it("refuses a signed-out visitor", async () => {
    authorize.mockResolvedValue(fail("unauthenticated", "Sign in to continue."));
    expect(await saveTemplateAction(valid)).toMatchObject({ ok: false, error: { code: "unauthenticated" } });
    expect(rpc.saveCertificateTemplate).not.toHaveBeenCalled();
  });

  it("refuses a course the coordinator is not assigned to, without calling the database", async () => {
    allow("coordinator");
    expect(await saveTemplateAction({ ...valid, courseId: otherCourseId })).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    expect(rpc.saveCertificateTemplate).not.toHaveBeenCalled();
  });

  it.each([
    ["nothing", undefined],
    ["text", "text"],
    ["a bad course id", { ...valid, courseId: "nope" }],
    ["an empty first name", { ...valid, signatory1Name: "   " }],
    ["an empty first title", { ...valid, signatory1Title: "" }],
    ["an empty second name", { ...valid, signatory2Name: "" }],
    ["an empty second title", { ...valid, signatory2Title: "  " }],
    ["a name over 100 characters", { ...valid, signatory1Name: "x".repeat(101) }],
    ["a missing field", { courseId, signatory1Name: "A" }],
    ["a name that is not text", { ...valid, signatory1Name: 5 }],
  ])("never sends %s to the database", async (_name, raw) => {
    allow("coordinator");
    expect(await saveTemplateAction(raw)).toMatchObject({ ok: false, error: { code: "validation" } });
    expect(rpc.saveCertificateTemplate).not.toHaveBeenCalled();
  });

  it.each([
    ["forbidden", "Only the coordinator of this course can change its evaluation form."],
    ["not_found", "Certificate template not found."],
    ["validation", "Each signatory needs a name and a title."],
  ] as const)("passes on the database's %s refusal", async (code, message) => {
    allow("coordinator");
    rpc.saveCertificateTemplate.mockResolvedValue(fail(code, message));
    expect(await saveTemplateAction(valid)).toEqual({ ok: false, error: { code, message } });
  });
});
