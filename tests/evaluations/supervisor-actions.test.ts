import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/roles";
import type { Session } from "@/lib/auth/session";
import { fail, ok } from "@/lib/result";

// The submit-evaluation action is the only door the supervisor's evaluation
// screen writes through. The session and the database layer are faked. These
// tests prove who may call it, that the supervisor comes from the session, that
// bad input never reaches the database, and that the database's refusals (the
// hours gate above all) come back as typed results.

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const authorize = vi.fn();
vi.mock("@/lib/auth/server", () => ({ authorize: (...args: unknown[]) => authorize(...args) }));

const rpc = { submitEvaluation: vi.fn() };
vi.mock("@/lib/db/rpc", () => rpc);

const { submitEvaluationAction } = await import("@/app/(app)/supervisor/evaluations/actions");

const userId = "00000000-0000-4000-8000-000000000001";
const deploymentId = "00000000-0000-4000-8000-0000000000d1";
const c1 = "00000000-0000-4000-8000-0000000000c1";
const c2 = "00000000-0000-4000-8000-0000000000c2";

const valid = {
  deploymentId,
  scores: [
    { criterionId: c1, score: 5 },
    { criterionId: c2, score: 3, comment: "  Needs to ask earlier  " },
  ],
  overallComment: "  Good intern  ",
};

function allow(role: Role) {
  authorize.mockImplementation(async (allowed: readonly Role[]) =>
    allowed.includes(role)
      ? ok({
          userId,
          clerkId: "clerk-1",
          role,
          studentId: null,
          courseIds: [],
          companyId: role === "supervisor" ? "company-1" : null,
          isCompanyOwner: false,
          hasConsent: true,
        } satisfies Session)
      : fail("forbidden", "You do not have access to this."),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  rpc.submitEvaluation.mockResolvedValue(ok("evaluation-1"));
});

describe("submitEvaluationAction", () => {
  it("submits as the session supervisor, trimming text and dropping empty comments", async () => {
    allow("supervisor");
    expect(await submitEvaluationAction(valid)).toEqual({ ok: true, data: null });
    expect(rpc.submitEvaluation).toHaveBeenCalledWith(userId, {
      deploymentId,
      scores: [
        { criterionId: c1, score: 5, comment: null },
        { criterionId: c2, score: 3, comment: "Needs to ask earlier" },
      ],
      overallComment: "Good intern",
    });
  });

  it("sends no overall comment when it is empty or missing", async () => {
    allow("supervisor");
    await submitEvaluationAction({ ...valid, overallComment: "   " });
    await submitEvaluationAction({ ...valid, overallComment: undefined });
    expect(rpc.submitEvaluation.mock.calls.map((call) => call[1].overallComment)).toEqual([null, null]);
  });

  it("ignores any actor, company, or form sent by the browser", async () => {
    allow("supervisor");
    await submitEvaluationAction({ ...valid, actorId: "x", companyId: "y", formId: "z" });
    expect(rpc.submitEvaluation.mock.calls[0][0]).toBe(userId);
    expect(Object.keys(rpc.submitEvaluation.mock.calls[0][1]).sort()).toEqual([
      "deploymentId",
      "overallComment",
      "scores",
    ]);
  });

  it.each(["admin", "student", "coordinator"] as const)("refuses a %s", async (role) => {
    allow(role);
    expect(await submitEvaluationAction(valid)).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    expect(rpc.submitEvaluation).not.toHaveBeenCalled();
  });

  it("refuses a signed-out visitor", async () => {
    authorize.mockResolvedValue(fail("unauthenticated", "Sign in to continue."));
    expect(await submitEvaluationAction(valid)).toMatchObject({
      ok: false,
      error: { code: "unauthenticated" },
    });
    expect(rpc.submitEvaluation).not.toHaveBeenCalled();
  });

  it.each([
    ["nothing", undefined],
    ["text", "text"],
    ["a bad student id", { ...valid, deploymentId: "nope" }],
    ["no scores", { ...valid, scores: [] }],
    ["no score list", { deploymentId }],
    ["a score of 0", { ...valid, scores: [{ criterionId: c1, score: 0 }] }],
    ["a score of 6", { ...valid, scores: [{ criterionId: c1, score: 6 }] }],
    ["a score that is not whole", { ...valid, scores: [{ criterionId: c1, score: 4.5 }] }],
    ["a score that is text", { ...valid, scores: [{ criterionId: c1, score: "5" }] }],
    ["a missing score", { ...valid, scores: [{ criterionId: c1 }] }],
    ["a bad criterion id", { ...valid, scores: [{ criterionId: "nope", score: 4 }] }],
    ["a comment over 500", { ...valid, scores: [{ criterionId: c1, score: 4, comment: "x".repeat(501) }] }],
    ["an overall comment over 2000", { ...valid, overallComment: "x".repeat(2001) }],
    ["more than 30 criteria", { ...valid, scores: Array.from({ length: 31 }, () => ({ criterionId: c1, score: 4 })) }],
  ])("never sends %s to the database", async (_name, raw) => {
    allow("supervisor");
    expect(await submitEvaluationAction(raw)).toMatchObject({
      ok: false,
      error: { code: "validation" },
    });
    expect(rpc.submitEvaluation).not.toHaveBeenCalled();
  });

  it.each([
    ["conflict", "This student has 9.00 of 18.00 required hours. They can be evaluated once they reach the required hours."],
    ["conflict", "Your coordinator has not published the evaluation form yet."],
    ["conflict", "This student has already been evaluated."],
    ["not_found", "Student not found."],
    ["validation", "Rate every criterion of the form."],
    ["forbidden", "Only a supervisor can decide on applicants."],
  ] as const)("passes on the database's %s refusal: %s", async (code, message) => {
    allow("supervisor");
    rpc.submitEvaluation.mockResolvedValue(fail(code, message));
    expect(await submitEvaluationAction(valid)).toEqual({ ok: false, error: { code, message } });
  });
});
