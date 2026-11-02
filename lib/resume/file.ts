import { z } from "zod";
import { fail, ok, type Result } from "@/lib/result";

// A resume is a PDF of at most 2 MB. The browser's file name and type are only
// hints, so the size, the type, the extension, and the file's own first bytes
// are all checked here on the server.

export const maxResumeBytes = 2 * 1024 * 1024;

const pdfSignature = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

export const resumeUploadSchema = z.object({
  file: z
    .instanceof(File, { message: "Choose a PDF file to upload." })
    .refine((file) => file.size > 0, "The file is empty.")
    .refine(
      (file) => file.size <= maxResumeBytes,
      "The file is larger than 2 MB. Upload a smaller PDF.",
    )
    .refine(
      (file) => /\.pdf$/i.test(file.name) && file.type === "application/pdf",
      "Only PDF files are accepted.",
    ),
});

export function startsLikePdf(bytes: Uint8Array): boolean {
  return pdfSignature.every((byte, index) => bytes[index] === byte);
}

// Validates the file and returns its bytes. Nothing is stored here.
export async function readResumeUpload(
  raw: unknown,
): Promise<Result<Uint8Array>> {
  const input = resumeUploadSchema.safeParse(
    raw instanceof FormData ? { file: raw.get("file") } : undefined,
  );
  if (!input.success) {
    return fail(
      "validation",
      input.error.issues[0]?.message ?? "Choose a PDF file to upload.",
    );
  }
  const bytes = new Uint8Array(await input.data.file.arrayBuffer());
  if (bytes.length === 0 || bytes.length > maxResumeBytes) {
    return fail("validation", "The file is larger than 2 MB. Upload a smaller PDF.");
  }
  if (!startsLikePdf(bytes)) {
    return fail("validation", "Only PDF files are accepted.");
  }
  return ok(bytes);
}
