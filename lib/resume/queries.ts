import "server-only";
import { z } from "zod";
import { adminClient } from "@/lib/db/admin";
import { errorFromDatabase, fail, ok, type Result } from "@/lib/result";

// The student's own resume record, for the resume screen. It uses the service
// role, so the caller must have run authorize(["student"]) and passes the
// student id from the session, never one from the browser.

export type ResumeRecord = { sizeBytes: number; uploadedAt: string };

const row = z.object({ size_bytes: z.number(), uploaded_at: z.string() });

export async function getOwnResume(
  studentId: string,
): Promise<Result<ResumeRecord | null>> {
  const { data, error } = await adminClient()
    .from("resumes")
    .select("size_bytes, uploaded_at")
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) return { ok: false, error: errorFromDatabase(error.message) };
  if (data === null) return ok(null);
  const parsed = row.safeParse(data);
  return parsed.success
    ? ok({ sizeBytes: parsed.data.size_bytes, uploadedAt: parsed.data.uploaded_at })
    : fail("unexpected", "Something went wrong. Try again in a moment.");
}
