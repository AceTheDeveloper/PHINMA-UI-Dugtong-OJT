"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/auth/server";
import {
  addMissedDay,
  approveLog,
  bulkApproveLogs,
  correctLog,
  rejectLog,
  reopenLog,
} from "@/lib/db/rpc";
import { fail, ok, type Result } from "@/lib/result";
import {
  approveSchema,
  bulkApproveSchema,
  correctSchema,
  missedDaySchema,
  rejectSchema,
  reopenSchema,
} from "@/lib/review/schemas";

// The supervisor's daily approval actions. Each checks the caller is a
// supervisor and validates the input; the database checks the entry belongs to
// a student of the supervisor's own company, its status, and the dates. The
// supervisor comes from the session, never from the browser.

const paths = ["/supervisor", "/supervisor/approvals", "/supervisor/students", "/student", "/student/logs"];

function refresh(extra?: string) {
  for (const path of paths) revalidatePath(path);
  if (extra) revalidatePath(extra);
}

function firstIssue(error: { issues: { message: string }[] }, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

export async function approveLogAction(raw: unknown): Promise<Result<null>> {
  const session = await authorize(["supervisor"]);
  if (!session.ok) return session;
  const input = approveSchema.safeParse(raw);
  if (!input.success) return fail("validation", firstIssue(input.error, "Choose an entry."));
  const done = await approveLog(session.data.userId, input.data.logId);
  if (!done.ok) return done;
  refresh();
  return ok(null);
}

export async function bulkApproveAction(raw: unknown): Promise<Result<number>> {
  const session = await authorize(["supervisor"]);
  if (!session.ok) return session;
  const input = bulkApproveSchema.safeParse(raw);
  if (!input.success) return fail("validation", firstIssue(input.error, "Choose at least one entry."));
  const done = await bulkApproveLogs(session.data.userId, input.data.logIds);
  if (!done.ok) return done;
  refresh();
  return ok(done.data);
}

export async function rejectLogAction(raw: unknown): Promise<Result<null>> {
  const session = await authorize(["supervisor"]);
  if (!session.ok) return session;
  const input = rejectSchema.safeParse(raw);
  if (!input.success) return fail("validation", firstIssue(input.error, "Check the entry."));
  const done = await rejectLog(session.data.userId, input.data.logId, input.data.reason);
  if (!done.ok) return done;
  refresh();
  return ok(null);
}

export async function correctLogAction(raw: unknown): Promise<Result<null>> {
  const session = await authorize(["supervisor"]);
  if (!session.ok) return session;
  const input = correctSchema.safeParse(raw);
  if (!input.success) return fail("validation", firstIssue(input.error, "Check the correction."));
  const done = await correctLog(session.data.userId, input.data);
  if (!done.ok) return done;
  refresh();
  return ok(null);
}

export async function reopenLogAction(raw: unknown): Promise<Result<null>> {
  const session = await authorize(["supervisor"]);
  if (!session.ok) return session;
  const input = reopenSchema.safeParse(raw);
  if (!input.success) return fail("validation", firstIssue(input.error, "Check the entry."));
  const done = await reopenLog(session.data.userId, input.data.logId, input.data.reason);
  if (!done.ok) return done;
  refresh();
  return ok(null);
}

export async function addMissedDayAction(raw: unknown): Promise<Result<null>> {
  const session = await authorize(["supervisor"]);
  if (!session.ok) return session;
  const input = missedDaySchema.safeParse(raw);
  if (!input.success) return fail("validation", firstIssue(input.error, "Check the day."));
  const done = await addMissedDay(session.data.userId, input.data);
  if (!done.ok) return done;
  refresh(`/supervisor/students/${input.data.deploymentId}`);
  return ok(null);
}
