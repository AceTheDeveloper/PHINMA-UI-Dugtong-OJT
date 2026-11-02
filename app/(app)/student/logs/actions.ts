"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/auth/server";
import { resubmitLog, saveJournal, timeIn, timeOut } from "@/lib/db/rpc";
import { resubmitSchema, saveJournalSchema, timeOutSchema } from "@/lib/logs/schemas";
import { fail, ok, type Result } from "@/lib/result";

// A student's daily log actions. Each checks the caller is a student and
// validates the input; the database checks the entry is the student's own, its
// status, and the schedule. The student comes from the session, never from the
// browser, and no time is accepted: time in and time out use the server clock.

const paths = ["/student", "/student/logs", "/supervisor/students"];

function refresh() {
  for (const path of paths) revalidatePath(path);
}

function firstIssue(error: { issues: { message: string }[] }, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

export async function timeInAction(): Promise<Result<null>> {
  const session = await authorize(["student"]);
  if (!session.ok) return session;
  const started = await timeIn(session.data.userId);
  if (!started.ok) return started;
  refresh();
  return ok(null);
}

export async function saveJournalAction(raw: unknown): Promise<Result<null>> {
  const session = await authorize(["student"]);
  if (!session.ok) return session;
  const input = saveJournalSchema.safeParse(raw);
  if (!input.success) return fail("validation", firstIssue(input.error, "Check the journal."));
  const saved = await saveJournal(session.data.userId, input.data.logId, input.data.journal);
  if (!saved.ok) return saved;
  refresh();
  return ok(null);
}

export async function timeOutAction(raw: unknown): Promise<Result<null>> {
  const session = await authorize(["student"]);
  if (!session.ok) return session;
  const input = timeOutSchema.safeParse(raw);
  if (!input.success) return fail("validation", firstIssue(input.error, "Check the entry."));
  const done = await timeOut(
    session.data.userId,
    input.data.logId,
    input.data.journal,
    input.data.earlyOutReason ? input.data.earlyOutReason : null,
  );
  if (!done.ok) return done;
  refresh();
  return ok(null);
}

export async function resubmitLogAction(raw: unknown): Promise<Result<null>> {
  const session = await authorize(["student"]);
  if (!session.ok) return session;
  const input = resubmitSchema.safeParse(raw);
  if (!input.success) return fail("validation", firstIssue(input.error, "Check the journal."));
  const done = await resubmitLog(session.data.userId, input.data.logId, input.data.journal);
  if (!done.ok) return done;
  refresh();
  return ok(null);
}
