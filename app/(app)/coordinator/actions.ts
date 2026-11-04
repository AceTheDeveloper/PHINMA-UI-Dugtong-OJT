"use server";

import { revalidatePath } from "next/cache";
import { canAccessCourse } from "@/lib/auth/scope";
import { authorize } from "@/lib/auth/server";
import { getBatchScope } from "@/lib/coordinator/queries";
import { coordinatorHoursSchema } from "@/lib/coordinator/required-hours";
import { setOjtRequiredHours } from "@/lib/db/rpc";
import { fail, ok, type Result } from "@/lib/result";

// The coordinator changes the required hours of their course's newest OJT batch
// (AGENTS.md section 4, ticket-32). The action checks the caller is a
// coordinator, validates the input, and checks the batch is in one of their
// courses; the database checks the role and course again and audits the change.

export async function changeRequiredHoursAction(raw: unknown): Promise<Result<null>> {
  const session = await authorize(["coordinator"]);
  if (!session.ok) return session;
  const input = coordinatorHoursSchema.safeParse(raw);
  if (!input.success) {
    return fail("validation", input.error.issues[0]?.message ?? "Check the required hours.");
  }

  const scope = await getBatchScope(input.data.batchId);
  if (!scope.ok) return scope;
  if (!scope.data || !canAccessCourse(session.data, scope.data.courseId)) {
    return fail("forbidden", "That batch is not in one of your courses.");
  }
  if (!scope.data.isNewest) {
    return fail("conflict", "A newer batch has started, so reload the page and edit that one.");
  }

  const saved = await setOjtRequiredHours(
    session.data.userId,
    input.data.batchId,
    Number(input.data.requiredHours),
  );
  if (!saved.ok) return saved;
  // Required hours show on every role's screens (hours chains, dashboards).
  revalidatePath("/", "layout");
  return ok(null);
}
