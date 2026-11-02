"use server";

import { revalidatePath } from "next/cache";
import { inviteUser, revokeInvitationEverywhere } from "@/lib/auth/invitations";
import { canAccessCourse } from "@/lib/auth/scope";
import { authorize } from "@/lib/auth/server";
import type { Session } from "@/lib/auth/session";
import { importRoster } from "@/lib/db/rpc";
import { fail, ok, type Result } from "@/lib/result";
import { parseRosterFile, type RosterRow } from "@/lib/roster/parse";
import {
  getBatchCourse,
  getConflictContext,
  getStudentForAction,
  getStudentsToInvite,
} from "@/lib/roster/queries";
import {
  batchSchema,
  rosterRowsSchema,
  rosterUploadSchema,
  studentSchema,
} from "@/lib/roster/schemas";
import type { Preview, SendReport } from "@/lib/roster/types";
import { validateRoster } from "@/lib/roster/validate";

// Every roster action: check the caller is an active coordinator or admin,
// validate the input, check the batch or student is in the caller's course,
// and only then read or write. The preview never writes. Student data is
// never logged.

const unexpected = "Something went wrong. Try again in a moment.";
const roles = ["coordinator", "admin"] as const;

async function access(): Promise<Result<Session>> {
  return authorize(roles);
}

// The caller must be allowed to work in this batch's course.
async function batchInScope(
  session: Session,
  batchId: string,
): Promise<Result<{ courseId: string; status: "planned" | "active" | "closed" }>> {
  const batch = await getBatchCourse(batchId);
  if (!batch.ok) return batch;
  if (batch.data === null) return fail("not_found", "That OJT batch was not found.");
  if (!canAccessCourse(session, batch.data.courseId)) {
    return fail("forbidden", "That OJT batch is not in one of your courses.");
  }
  return ok(batch.data);
}

type Checked = { preview: Preview; session: Session };

// The shared check behind preview, re-check, and commit: the caller's course,
// an open batch, then the roster rules against the database. Whatever the
// browser says about a row is never trusted.
async function checkRows(
  session: Session,
  batchId: string,
  fileName: string,
  rows: RosterRow[],
): Promise<Result<Checked>> {
  const batch = await batchInScope(session, batchId);
  if (!batch.ok) return batch;
  if (batch.data.status === "closed") {
    return fail("conflict", "That OJT batch is closed. Choose an open batch.");
  }

  const context = await getConflictContext(
    batchId,
    batch.data.courseId,
    rows.map((row) => row.email.trim().toLowerCase()).filter((email) => email !== ""),
  );
  if (!context.ok) return context;

  const check = validateRoster(rows, context.data);
  return ok({
    session,
    preview: {
      batchId,
      fileName,
      rows: check.rows,
      ready: check.ready,
      withProblems: check.withProblems,
    },
  });
}

// Reads the uploaded file, then checks its rows.
async function checkUpload(raw: unknown): Promise<Result<Checked>> {
  const session = await access();
  if (!session.ok) return session;

  const input = rosterUploadSchema.safeParse(
    raw instanceof FormData
      ? { batchId: raw.get("batchId"), file: raw.get("file") }
      : undefined,
  );
  if (!input.success) {
    return fail("validation", input.error.issues[0]?.message ?? "Check the upload and try again.");
  }

  // Scope first, so a file is never read for a batch the caller cannot use.
  const batch = await batchInScope(session.data, input.data.batchId);
  if (!batch.ok) return batch;

  const parsed = await parseRosterFile({
    name: input.data.file.name,
    bytes: new Uint8Array(await input.data.file.arrayBuffer()),
  });
  if (!parsed.ok) return parsed;
  return checkRows(session.data, input.data.batchId, input.data.file.name, parsed.data);
}

// Checks the rows the coordinator is working on, after edits and removals.
async function checkWorkingRows(raw: unknown): Promise<Result<Checked>> {
  const session = await access();
  if (!session.ok) return session;

  const input = rosterRowsSchema.safeParse(raw);
  if (!input.success) {
    return fail("validation", input.error.issues[0]?.message ?? "Check the rows and try again.");
  }
  return checkRows(session.data, input.data.batchId, "", input.data.rows);
}

export async function previewRoster(raw: unknown): Promise<Result<Preview>> {
  const checked = await checkUpload(raw);
  return checked.ok ? ok(checked.data.preview) : checked;
}

// Same rules as the preview, for rows edited or removed on screen. Writes nothing.
export async function recheckRoster(raw: unknown): Promise<Result<Preview>> {
  const checked = await checkWorkingRows(raw);
  return checked.ok ? ok(checked.data.preview) : checked;
}

// Imports the rows on screen, all or none. The file is not read again: the
// rows are checked on the server as if they were a fresh upload.
export async function commitRoster(raw: unknown): Promise<Result<{ imported: number }>> {
  const checked = await checkWorkingRows(raw);
  if (!checked.ok) return checked;
  const { preview, session } = checked.data;
  if (preview.withProblems > 0) {
    return fail(
      "validation",
      `Fix the ${preview.withProblems} ${preview.withProblems === 1 ? "row" : "rows"} with problems before you commit.`,
    );
  }
  const imported = await importRoster(session.userId, preview.batchId, preview.rows);
  if (!imported.ok) return imported;
  revalidatePath("/coordinator/roster");
  revalidatePath("/admin/roster");
  revalidatePath("/admin/audit");
  return ok({ imported: imported.data });
}

const groupSize = 5;

// Sends an invitation to every student in the batch who has none that is
// pending or accepted. Safe to run again: it skips students already invited,
// and one failure does not stop the others.
export async function sendInvitations(raw: unknown): Promise<Result<SendReport>> {
  const session = await access();
  if (!session.ok) return session;
  const input = batchSchema.safeParse(raw);
  if (!input.success) {
    return fail("validation", input.error.issues[0]?.message ?? "Choose an OJT batch.");
  }
  const batch = await batchInScope(session.data, input.data.batchId);
  if (!batch.ok) return batch;

  const students = await getStudentsToInvite(input.data.batchId);
  if (!students.ok) return students;

  const report: SendReport = { sent: 0, failed: [] };
  for (let index = 0; index < students.data.length; index += groupSize) {
    const group = students.data.slice(index, index + groupSize);
    const results = await Promise.all(
      group.map(async (student) => ({
        student,
        result: await inviteUser({
          actorId: session.data.userId,
          role: "student",
          email: student.email,
          studentId: student.id,
        }).catch(() => fail("unexpected", unexpected)),
      })),
    );
    for (const { student, result } of results) {
      if (result.ok) {
        report.sent += 1;
      } else {
        report.failed.push({
          studentId: student.id,
          name: student.fullName,
          message: result.error.message,
        });
      }
    }
  }
  revalidatePath("/coordinator/roster");
  revalidatePath("/admin/roster");
  revalidatePath("/admin/audit");
  return ok(report);
}

// Replaces a student's pending invitation with a new one (for example after a
// corrected email or an expired link).
export async function resendInvitation(raw: unknown): Promise<Result<null>> {
  const session = await access();
  if (!session.ok) return session;
  const input = studentSchema.safeParse(raw);
  if (!input.success) {
    return fail("validation", input.error.issues[0]?.message ?? "Choose a student.");
  }

  const student = await getStudentForAction(input.data.studentId);
  if (!student.ok) return student;
  if (student.data === null) return fail("not_found", "That student was not found.");
  if (!canAccessCourse(session.data, student.data.courseId)) {
    return fail("forbidden", "That student is not in one of your courses.");
  }
  if (student.data.hasAccount) {
    return fail("conflict", "This student already has an account.");
  }

  if (student.data.pendingInvitationId) {
    const revoked = await revokeInvitationEverywhere(
      session.data.userId,
      student.data.pendingInvitationId,
    );
    if (!revoked.ok) return revoked;
  }
  const sent = await inviteUser({
    actorId: session.data.userId,
    role: "student",
    email: student.data.email,
    studentId: student.data.id,
  }).catch(() => fail("unexpected", unexpected));
  if (!sent.ok) return sent;
  revalidatePath("/coordinator/roster");
  revalidatePath("/admin/roster");
  revalidatePath("/admin/audit");
  return ok(null);
}
