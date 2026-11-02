import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/roles";
import type { Session } from "@/lib/auth/session";
import { fail, ok } from "@/lib/result";

// The coordinator's evaluation form actions are the only door the screen writes
// through. The session and the database layer are faked. These tests prove who
// may call them (the admin may not), that the coordinator comes from the
// session, that bad input never reaches the database, and that the database's
// refusals come back as typed results.

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const authorize = vi.fn();
vi.mock("@/lib/auth/server", () => ({ authorize: (...args: unknown[]) => authorize(...args) }));

const rpc = {
  createEvaluationDraft: vi.fn(),
  saveEvaluationDraft: vi.fn(),
  publishEvaluationForm: vi.fn(),
  discardEvaluationDraft: vi.fn(),
};
vi.mock("@/lib/db/rpc", () => rpc);

const actions = await import("@/app/(app)/coordinator/evaluations/actions");

const userId = "00000000-0000-4000-8000-000000000001";
const courseId = "00000000-0000-4000-8000-0000000000c1";
const otherCourseId = "00000000-0000-4000-8000-0000000000c2";
const formId = "00000000-0000-4000-8000-0000000000f1";

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
  rpc.createEvaluationDraft.mockResolvedValue(ok("form-1"));
  rpc.saveEvaluationDraft.mockResolvedValue(ok(null));
  rpc.publishEvaluationForm.mockResolvedValue(ok(null));
  rpc.discardEvaluationDraft.mockResolvedValue(ok(null));
});

const cases = [
  ["create a draft", () => actions.createDraftAction({ courseId }), () => rpc.createEvaluationDraft],
  ["save a draft", () => actions.saveDraftAction({ formId, criteria: ["Teamwork"] }), () => rpc.saveEvaluationDraft],
  ["publish", () => actions.publishFormAction({ formId, criteria: ["Teamwork"] }), () => rpc.publishEvaluationForm],
  ["discard", () => actions.discardDraftAction({ formId }), () => rpc.discardEvaluationDraft],
] as const;

describe.each(cases)("%s", (_name, run, rpcFn) => {
  it("runs as the session coordinator", async () => {
    allow("coordinator");
    expect(await run()).toEqual({ ok: true, data: null });
    expect(rpcFn()).toHaveBeenCalledTimes(1);
    expect(rpcFn().mock.calls[0][0]).toBe(userId);
  });

  it.each(["admin", "supervisor", "student"] as const)("refuses a %s", async (role) => {
    allow(role);
    expect(await run()).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(rpcFn()).not.toHaveBeenCalled();
  });

  it("refuses a signed-out visitor", async () => {
    authorize.mockResolvedValue(fail("unauthenticated", "Sign in to continue."));
    expect(await run()).toMatchObject({ ok: false, error: { code: "unauthenticated" } });
    expect(rpcFn()).not.toHaveBeenCalled();
  });

  it.each([
    ["not_found", "Evaluation form not found."],
    ["conflict", "Only a draft can be edited."],
    ["validation", "A criterion cannot be empty."],
  ] as const)("passes on the database's %s refusal", async (code, message) => {
    allow("coordinator");
    rpcFn().mockResolvedValue(fail(code, message));
    expect(await run()).toEqual({ ok: false, error: { code, message } });
  });
});

describe("create a draft", () => {
  it("refuses a course the coordinator is not assigned to, without calling the database", async () => {
    allow("coordinator");
    expect(await actions.createDraftAction({ courseId: otherCourseId })).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    expect(rpc.createEvaluationDraft).not.toHaveBeenCalled();
  });

  it.each([undefined, {}, { courseId: "nope" }, { courseId: 3 }, "text"])(
    "never sends %j to the database",
    async (raw) => {
      allow("coordinator");
      expect(await actions.createDraftAction(raw)).toMatchObject({
        ok: false,
        error: { code: "validation" },
      });
      expect(rpc.createEvaluationDraft).not.toHaveBeenCalled();
    },
  );
});

describe("save a draft", () => {
  it("sends the criteria trimmed, in order", async () => {
    allow("coordinator");
    await actions.saveDraftAction({ formId, criteria: ["  Teamwork ", "Punctuality"] });
    expect(rpc.saveEvaluationDraft).toHaveBeenCalledWith(userId, formId, ["Teamwork", "Punctuality"]);
  });

  it("allows an empty list, which clears the draft", async () => {
    allow("coordinator");
    expect(await actions.saveDraftAction({ formId, criteria: [] })).toEqual({ ok: true, data: null });
  });

  it.each([
    ["a bad form id", { formId: "nope", criteria: ["Teamwork"] }],
    ["no criteria list", { formId }],
    ["an empty criterion", { formId, criteria: ["Teamwork", "  "] }],
    ["a criterion over 200 characters", { formId, criteria: ["x".repeat(201)] }],
    ["duplicates ignoring case", { formId, criteria: ["Teamwork", "teamwork"] }],
    ["more than 30 criteria", { formId, criteria: Array.from({ length: 31 }, (_, index) => `C${index}`) }],
    ["a criterion that is not text", { formId, criteria: [5] }],
  ])("never sends %s to the database", async (_name, raw) => {
    allow("coordinator");
    expect(await actions.saveDraftAction(raw)).toMatchObject({
      ok: false,
      error: { code: "validation" },
    });
    expect(rpc.saveEvaluationDraft).not.toHaveBeenCalled();
  });
});

describe("publish", () => {
  it("saves the criteria on screen first, then publishes, in that order", async () => {
    allow("coordinator");
    const order: string[] = [];
    rpc.saveEvaluationDraft.mockImplementation(async () => {
      order.push("save");
      return ok(null);
    });
    rpc.publishEvaluationForm.mockImplementation(async () => {
      order.push("publish");
      return ok(null);
    });
    await actions.publishFormAction({ formId, criteria: ["Teamwork"] });
    expect(order).toEqual(["save", "publish"]);
    expect(rpc.publishEvaluationForm).toHaveBeenCalledWith(userId, formId);
  });

  it("does not publish when the save fails", async () => {
    allow("coordinator");
    rpc.saveEvaluationDraft.mockResolvedValue(fail("validation", "Two criteria have the same name."));
    expect(await actions.publishFormAction({ formId, criteria: ["A", "B"] })).toMatchObject({
      ok: false,
    });
    expect(rpc.publishEvaluationForm).not.toHaveBeenCalled();
  });

  it("refuses an empty list before it reaches the database", async () => {
    allow("coordinator");
    expect(await actions.publishFormAction({ formId, criteria: [] })).toMatchObject({
      ok: false,
      error: { code: "validation", message: "Add at least one criterion before you publish." },
    });
    expect(rpc.saveEvaluationDraft).not.toHaveBeenCalled();
    expect(rpc.publishEvaluationForm).not.toHaveBeenCalled();
  });
});

describe("discard", () => {
  it.each([undefined, {}, { formId: "nope" }])("never sends %j to the database", async (raw) => {
    allow("coordinator");
    expect(await actions.discardDraftAction(raw)).toMatchObject({
      ok: false,
      error: { code: "validation" },
    });
    expect(rpc.discardEvaluationDraft).not.toHaveBeenCalled();
  });
});
