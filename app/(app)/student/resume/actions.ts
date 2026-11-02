"use server";

import { z } from "zod";
import { authorize } from "@/lib/auth/server";
import { getResumePath, saveResume } from "@/lib/db/rpc";
import { readResumeUpload } from "@/lib/resume/file";
import { resumePathFor, signResumeLink, storeResume } from "@/lib/resume/storage";
import { fail, ok, type Result } from "@/lib/result";

// Every resume action: check the caller's role, validate the input, then let
// the database decide whose resume it is. The student id for an upload comes
// from the session, never from the browser. File names and contents are never
// logged.

const unexpected = "Something went wrong. Try again in a moment.";

// A student uploads or replaces their own resume. Writes nothing if the file
// is not a PDF of at most 2 MB.
export async function uploadResume(raw: unknown): Promise<Result<null>> {
  const session = await authorize(["student"]);
  if (!session.ok) return session;
  const studentId = session.data.studentId;
  if (!studentId) return fail("forbidden", "You do not have access to this.");

  const file = await readResumeUpload(raw);
  if (!file.ok) return file;

  const path = resumePathFor(studentId);
  const stored = await storeResume(path, file.data);
  if (!stored.ok) return stored;

  const saved = await saveResume(session.data.userId, file.data.length);
  if (!saved.ok) return saved;
  if (saved.data !== path) return fail("unexpected", unexpected);
  return ok(null);
}

const linkInput = z.object({ studentId: z.string().uuid("Choose a student.") });

// A short-lived link to open a resume. The database checks who may read it:
// the student, or the coordinator of the student's course. Admins cannot.
export async function getResumeLink(raw: unknown): Promise<Result<string>> {
  const session = await authorize(["student", "coordinator", "supervisor"]);
  if (!session.ok) return session;

  const input = linkInput.safeParse(raw);
  if (!input.success) {
    return fail("validation", input.error.issues[0]?.message ?? "Choose a student.");
  }
  const path = await getResumePath(session.data.userId, input.data.studentId);
  if (!path.ok) return path;
  return signResumeLink(path.data);
}
