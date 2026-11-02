"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize } from "@/lib/auth/server";
import { acceptApplication, rejectApplication } from "@/lib/db/rpc";
import { fail, ok, type Result } from "@/lib/result";

// A supervisor decides on an applicant. Each action checks the caller is a
// supervisor, validates the id, and lets the database decide: it checks the
// application is for the supervisor's own company and still waiting. The
// supervisor comes from the session, never from the browser.

const decisionSchema = z.object({
  applicationId: z.string().uuid("Choose an application."),
});

const paths = ["/supervisor", "/supervisor/applicants", "/student", "/student/applications"];

export async function acceptApplicationAction(raw: unknown): Promise<Result<null>> {
  const session = await authorize(["supervisor"]);
  if (!session.ok) return session;

  const input = decisionSchema.safeParse(raw);
  if (!input.success) {
    return fail("validation", input.error.issues[0]?.message ?? "Choose an application.");
  }
  const accepted = await acceptApplication(session.data.userId, input.data.applicationId);
  if (!accepted.ok) return accepted;
  for (const path of paths) revalidatePath(path);
  return ok(null);
}

export async function rejectApplicationAction(raw: unknown): Promise<Result<null>> {
  const session = await authorize(["supervisor"]);
  if (!session.ok) return session;

  const input = decisionSchema.safeParse(raw);
  if (!input.success) {
    return fail("validation", input.error.issues[0]?.message ?? "Choose an application.");
  }
  const rejected = await rejectApplication(session.data.userId, input.data.applicationId);
  if (!rejected.ok) return rejected;
  for (const path of paths) revalidatePath(path);
  return ok(null);
}
