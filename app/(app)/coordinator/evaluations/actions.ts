"use server";

import { revalidatePath } from "next/cache";
import { canAccessCourse } from "@/lib/auth/scope";
import { authorize } from "@/lib/auth/server";
import {
  createEvaluationDraft,
  discardEvaluationDraft,
  publishEvaluationForm,
  saveEvaluationDraft,
} from "@/lib/db/rpc";
import {
  createDraftSchema,
  formIdSchema,
  publishSchema,
  saveDraftSchema,
} from "@/lib/evaluations/schemas";
import { fail, ok, type Result } from "@/lib/result";

// The coordinator's evaluation form actions. Each checks the caller is a
// coordinator (the admin cannot edit forms) and validates the input; the
// database checks the form belongs to a course the coordinator is assigned to
// and that its status allows the change. The coordinator comes from the
// session, never from the browser.

const path = "/coordinator/evaluations";

function firstIssue(error: { issues: { message: string }[] }, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

export async function createDraftAction(raw: unknown): Promise<Result<null>> {
  const session = await authorize(["coordinator"]);
  if (!session.ok) return session;
  const input = createDraftSchema.safeParse(raw);
  if (!input.success) return fail("validation", firstIssue(input.error, "Choose a course."));
  if (!canAccessCourse(session.data, input.data.courseId)) {
    return fail("forbidden", "That course is not one of yours.");
  }
  const created = await createEvaluationDraft(session.data.userId, input.data.courseId);
  if (!created.ok) return created;
  revalidatePath(path);
  return ok(null);
}

export async function saveDraftAction(raw: unknown): Promise<Result<null>> {
  const session = await authorize(["coordinator"]);
  if (!session.ok) return session;
  const input = saveDraftSchema.safeParse(raw);
  if (!input.success) return fail("validation", firstIssue(input.error, "Check the criteria."));
  const saved = await saveEvaluationDraft(session.data.userId, input.data.formId, input.data.criteria);
  if (!saved.ok) return saved;
  revalidatePath(path);
  return ok(null);
}

// Saves the criteria on screen and publishes them in one step, so what the
// coordinator sees is what supervisors get.
export async function publishFormAction(raw: unknown): Promise<Result<null>> {
  const session = await authorize(["coordinator"]);
  if (!session.ok) return session;
  const input = publishSchema.safeParse(raw);
  if (!input.success) return fail("validation", firstIssue(input.error, "Check the criteria."));
  const saved = await saveEvaluationDraft(session.data.userId, input.data.formId, input.data.criteria);
  if (!saved.ok) return saved;
  const published = await publishEvaluationForm(session.data.userId, input.data.formId);
  if (!published.ok) return published;
  revalidatePath(path);
  return ok(null);
}

export async function discardDraftAction(raw: unknown): Promise<Result<null>> {
  const session = await authorize(["coordinator"]);
  if (!session.ok) return session;
  const input = formIdSchema.safeParse(raw);
  if (!input.success) return fail("validation", firstIssue(input.error, "Choose a form."));
  const discarded = await discardEvaluationDraft(session.data.userId, input.data.formId);
  if (!discarded.ok) return discarded;
  revalidatePath(path);
  return ok(null);
}
