"use server";

import { revalidatePath } from "next/cache";
import { applySchema, withdrawSchema } from "@/lib/applications/schemas";
import { authorize } from "@/lib/auth/server";
import { applyToListing, withdrawApplication } from "@/lib/db/rpc";
import { fail, ok, type Result } from "@/lib/result";

// The two actions a student has on applications. Each checks the caller is a
// student, validates the input, and lets the database decide: it checks the
// student's own course, resume, and ownership. The student comes from the
// session, never from the browser.

export async function applyToListingAction(raw: unknown): Promise<Result<null>> {
  const session = await authorize(["student"]);
  if (!session.ok) return session;

  const input = applySchema.safeParse(raw);
  if (!input.success) {
    return fail("validation", input.error.issues[0]?.message ?? "Choose a listing.");
  }
  const applied = await applyToListing(session.data.userId, input.data.listingId);
  if (!applied.ok) return applied;
  revalidatePath("/student", "layout");
  return ok(null);
}

export async function withdrawApplicationAction(raw: unknown): Promise<Result<null>> {
  const session = await authorize(["student"]);
  if (!session.ok) return session;

  const input = withdrawSchema.safeParse(raw);
  if (!input.success) {
    return fail("validation", input.error.issues[0]?.message ?? "Choose an application.");
  }
  const withdrawn = await withdrawApplication(session.data.userId, input.data.applicationId);
  if (!withdrawn.ok) return withdrawn;
  revalidatePath("/student", "layout");
  return ok(null);
}
