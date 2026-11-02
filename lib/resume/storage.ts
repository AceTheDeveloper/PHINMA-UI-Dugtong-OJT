import "server-only";
import { adminClient } from "@/lib/db/admin";
import { fail, ok, type Result } from "@/lib/result";

// The only code that touches the resumes bucket. It uses the service-role
// client, so callers must have checked the caller's role and scope first.

const bucket = "resumes";
const signedLinkSeconds = 60;
const unexpected = "Something went wrong. Try again in a moment.";

export function resumePathFor(studentId: string): string {
  return `${studentId}/resume.pdf`;
}

export async function storeResume(
  path: string,
  bytes: Uint8Array,
): Promise<Result<null>> {
  const { error } = await adminClient()
    .storage.from(bucket)
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  return error ? fail("unexpected", unexpected) : ok(null);
}

export async function signResumeLink(path: string): Promise<Result<string>> {
  const { data, error } = await adminClient()
    .storage.from(bucket)
    .createSignedUrl(path, signedLinkSeconds);
  if (error || !data?.signedUrl) return fail("unexpected", unexpected);
  return ok(data.signedUrl);
}
