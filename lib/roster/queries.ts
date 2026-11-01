import "server-only";
import { z } from "zod";
import { adminClient } from "@/lib/db/admin";
import { canAccessCourse } from "@/lib/auth/scope";
import type { Session } from "@/lib/auth/session";
import type { BatchOption, InviteState, RosterStudent } from "@/lib/roster/types";
import type { ConflictContext } from "@/lib/roster/validate";
import { errorFromDatabase, fail, ok, type Result } from "@/lib/result";

// Reads for the roster screen. They use the service role, so every caller has
// already run authorize(["coordinator", "admin"]) and checks course scope with
// the helpers below before returning anything.

const unexpected = "Something went wrong. Try again in a moment.";
const db = () => adminClient();

async function read<S extends z.ZodType>(
  schema: S,
  run: () => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<Result<z.infer<S>>> {
  const { data, error } = await run();
  if (error) return { ok: false, error: errorFromDatabase(error.message) };
  const parsed = schema.safeParse(data);
  return parsed.success ? ok(parsed.data) : fail("unexpected", unexpected);
}

// PostgREST puts .in() lists in the URL, so long lists go in chunks.
function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

const batchRow = z.object({
  id: z.string(),
  course_id: z.string(),
  school_year: z.string(),
  status: z.enum(["planned", "active", "closed"]),
});
const courseRow = z.object({ id: z.string(), code: z.string() });

// The OJT batches this person may import into: open batches of their courses
// (an admin sees every course).
export async function getBatchOptions(session: Session): Promise<Result<BatchOption[]>> {
  const batches = await read(z.array(batchRow), () =>
    db()
      .from("ojt_batches")
      .select("id, course_id, school_year, status")
      .neq("status", "closed")
      .order("school_year", { ascending: false }),
  );
  if (!batches.ok) return batches;
  const allowed = batches.data.filter((batch) => canAccessCourse(session, batch.course_id));
  const courseIds = [...new Set(allowed.map((batch) => batch.course_id))];
  if (courseIds.length === 0) return ok([]);
  const courses = await read(z.array(courseRow), () =>
    db().from("courses").select("id, code").in("id", courseIds),
  );
  if (!courses.ok) return courses;
  return ok(
    allowed.map((batch) => ({
      id: batch.id,
      courseId: batch.course_id,
      label: `${courses.data.find((course) => course.id === batch.course_id)?.code ?? "Course"} · ${batch.school_year}`,
    })),
  );
}

// The course of a batch, for the scope check before any preview or commit.
export async function getBatchCourse(
  batchId: string,
): Promise<Result<{ courseId: string; status: "planned" | "active" | "closed" } | null>> {
  const found = await read(z.array(batchRow), () =>
    db().from("ojt_batches").select("id, course_id, school_year, status").eq("id", batchId),
  );
  if (!found.ok) return found;
  const batch = found.data[0];
  return ok(batch ? { courseId: batch.course_id, status: batch.status } : null);
}

const studentNumberRow = z.object({ student_number: z.string() });
const emailRow = z.object({ email: z.string(), course_id: z.string() });
const accountRow = z.object({ email: z.string() });

// What the database already holds that this file could collide with.
export async function getConflictContext(
  batchId: string,
  courseId: string,
  emails: readonly string[],
): Promise<Result<ConflictContext>> {
  const numbers = await read(z.array(studentNumberRow), () =>
    db().from("students").select("student_number").eq("ojt_batch_id", batchId),
  );
  if (!numbers.ok) return numbers;

  const emailCourse = new Map<string, string>();
  const accountEmails = new Set<string>();
  for (const group of chunks([...new Set(emails)], 100)) {
    const students = await read(z.array(emailRow), () =>
      db().from("students").select("email, course_id").in("email", group),
    );
    if (!students.ok) return students;
    for (const student of students.data) {
      emailCourse.set(student.email.toLowerCase(), student.course_id);
    }
    const accounts = await read(z.array(accountRow), () =>
      db().from("users").select("email").in("email", group),
    );
    if (!accounts.ok) return accounts;
    for (const account of accounts.data) accountEmails.add(account.email.toLowerCase());
  }

  return ok({
    courseId,
    numbersInBatch: new Set(numbers.data.map((row) => row.student_number.toLowerCase())),
    emailCourse,
    accountEmails,
  });
}

const studentRow = z.object({
  id: z.string(),
  user_id: z.string().nullable(),
  course_id: z.string(),
  full_name: z.string(),
  student_number: z.string(),
  email: z.string(),
});
const invitationRow = z.object({
  id: z.string(),
  student_id: z.string().nullable(),
  status: z.enum(["pending", "used", "expired", "revoked"]),
  expires_at: z.string(),
});

// The state of a student's invitation, from their account and newest invitation.
function inviteState(
  hasAccount: boolean,
  latest: { status: string; expires_at: string } | undefined,
): InviteState {
  if (hasAccount) return "accepted";
  if (!latest) return "not_invited";
  if (latest.status === "pending") {
    return new Date(latest.expires_at) > new Date() ? "pending" : "expired";
  }
  if (latest.status === "revoked") return "revoked";
  if (latest.status === "expired") return "expired";
  return "not_invited";
}

async function newestInvitations(studentIds: readonly string[]) {
  const latest = new Map<string, z.infer<typeof invitationRow>>();
  for (const group of chunks(studentIds, 100)) {
    const found = await read(z.array(invitationRow), () =>
      db()
        .from("invitations")
        .select("id, student_id, status, expires_at")
        .eq("role", "student")
        .in("student_id", group)
        .order("created_at", { ascending: false }),
    );
    if (!found.ok) return found;
    for (const invitation of found.data) {
      // rows come newest first, so the first one seen per student is the newest
      if (invitation.student_id && !latest.has(invitation.student_id)) {
        latest.set(invitation.student_id, invitation);
      }
    }
  }
  return ok(latest);
}

export async function getRoster(batchId: string): Promise<Result<RosterStudent[]>> {
  const students = await read(z.array(studentRow), () =>
    db()
      .from("students")
      .select("id, user_id, course_id, full_name, student_number, email")
      .eq("ojt_batch_id", batchId)
      .order("full_name"),
  );
  if (!students.ok) return students;
  const latest = await newestInvitations(students.data.map((student) => student.id));
  if (!latest.ok) return latest;
  return ok(
    students.data.map((student) => ({
      id: student.id,
      fullName: student.full_name,
      studentNumber: student.student_number,
      email: student.email,
      status: inviteState(student.user_id !== null, latest.data.get(student.id)),
    })),
  );
}

export type StudentForAction = {
  id: string;
  courseId: string;
  email: string;
  fullName: string;
  hasAccount: boolean;
  state: InviteState;
  pendingInvitationId: string | null;
};

// One student with what the invite actions need to know, or null.
export async function getStudentForAction(
  studentId: string,
): Promise<Result<StudentForAction | null>> {
  const found = await read(z.array(studentRow), () =>
    db()
      .from("students")
      .select("id, user_id, course_id, full_name, student_number, email")
      .eq("id", studentId),
  );
  if (!found.ok) return found;
  const student = found.data[0];
  if (!student) return ok(null);
  const latest = await newestInvitations([student.id]);
  if (!latest.ok) return latest;
  const newest = latest.data.get(student.id);
  const state = inviteState(student.user_id !== null, newest);
  return ok({
    id: student.id,
    courseId: student.course_id,
    email: student.email,
    fullName: student.full_name,
    hasAccount: student.user_id !== null,
    state,
    pendingInvitationId: state === "pending" && newest ? newest.id : null,
  });
}

// The students of a batch that still need an invitation sent.
export async function getStudentsToInvite(
  batchId: string,
): Promise<Result<{ id: string; fullName: string; email: string }[]>> {
  const roster = await getRoster(batchId);
  if (!roster.ok) return roster;
  return ok(
    roster.data
      .filter((student) => ["not_invited", "expired", "revoked"].includes(student.status))
      .map((student) => ({ id: student.id, fullName: student.fullName, email: student.email })),
  );
}
