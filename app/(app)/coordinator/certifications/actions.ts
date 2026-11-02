"use server";

import { revalidatePath } from "next/cache";
import { saveTemplateSchema } from "@/lib/certification/schemas";
import { canAccessCourse } from "@/lib/auth/scope";
import { authorize } from "@/lib/auth/server";
import { saveCertificateTemplate } from "@/lib/db/rpc";
import { fail, ok, type Result } from "@/lib/result";

// The coordinator names the signatories of their course's certificates. The
// action checks the caller is a coordinator of that course and validates the
// input; the database checks it again. The coordinator comes from the session.

export async function saveTemplateAction(raw: unknown): Promise<Result<null>> {
  const session = await authorize(["coordinator"]);
  if (!session.ok) return session;
  const input = saveTemplateSchema.safeParse(raw);
  if (!input.success) {
    return fail("validation", input.error.issues[0]?.message ?? "Check the signatories.");
  }
  if (!canAccessCourse(session.data, input.data.courseId)) {
    return fail("forbidden", "That course is not one of yours.");
  }
  const saved = await saveCertificateTemplate(session.data.userId, input.data);
  if (!saved.ok) return saved;
  revalidatePath("/coordinator/certifications");
  return ok(null);
}
