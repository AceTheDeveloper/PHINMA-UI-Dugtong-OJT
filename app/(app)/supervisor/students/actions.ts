"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/auth/server";
import { setWorkSchedule } from "@/lib/db/rpc";
import { fail, ok, type Result } from "@/lib/result";
import { setScheduleSchema } from "@/lib/schedules/schemas";

// A supervisor sets a student's work schedule. The action checks the caller is
// a supervisor and validates the input; the database checks the student is at
// the supervisor's own company and the dates are valid. The supervisor comes
// from the session, never from the browser.

export async function setWorkScheduleAction(raw: unknown): Promise<Result<null>> {
  const session = await authorize(["supervisor"]);
  if (!session.ok) return session;

  const input = setScheduleSchema.safeParse(raw);
  if (!input.success) {
    return fail("validation", input.error.issues[0]?.message ?? "Check the schedule and try again.");
  }
  const saved = await setWorkSchedule(session.data.userId, input.data);
  if (!saved.ok) return saved;
  revalidatePath("/supervisor/students");
  revalidatePath(`/supervisor/students/${input.data.deploymentId}`);
  return ok(null);
}
