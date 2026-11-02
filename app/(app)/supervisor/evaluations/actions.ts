"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/auth/server";
import { submitEvaluation } from "@/lib/db/rpc";
import { submitEvaluationSchema } from "@/lib/evaluations/schemas";
import { fail, ok, type Result } from "@/lib/result";

// The supervisor submits a student's final evaluation. The action checks the
// caller is a supervisor and validates the input; the database checks the
// student is at the supervisor's own company, the hours gate, the published
// form, and that every criterion is rated. The supervisor comes from the
// session, never from the browser.

export async function submitEvaluationAction(raw: unknown): Promise<Result<null>> {
  const session = await authorize(["supervisor"]);
  if (!session.ok) return session;

  const input = submitEvaluationSchema.safeParse(raw);
  if (!input.success) {
    return fail("validation", input.error.issues[0]?.message ?? "Check the evaluation.");
  }
  const submitted = await submitEvaluation(session.data.userId, {
    deploymentId: input.data.deploymentId,
    scores: input.data.scores.map((item) => ({
      criterionId: item.criterionId,
      score: item.score,
      comment: item.comment ? item.comment : null,
    })),
    overallComment: input.data.overallComment ? input.data.overallComment : null,
  });
  if (!submitted.ok) return submitted;

  for (const path of [
    "/supervisor",
    "/supervisor/evaluations",
    `/supervisor/evaluations/${input.data.deploymentId}`,
    "/supervisor/students",
    "/student",
  ]) {
    revalidatePath(path);
  }
  return ok(null);
}
