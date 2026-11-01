import { z } from "zod";
import { maxFileBytes } from "@/lib/roster/parse";

// Input to the roster actions. The file arrives as FormData from the browser,
// so its name, size, and type are all checked here and again when it is parsed.

export const rosterUploadSchema = z.object({
  batchId: z.string().uuid("Choose an OJT batch."),
  file: z
    .instanceof(File, { message: "Choose a file to upload." })
    .refine((file) => file.size > 0, "The file is empty.")
    .refine((file) => file.size <= maxFileBytes, "The file is larger than 2 MB. Split it and import in parts.")
    .refine(
      (file) => /\.(csv|xlsx)$/i.test(file.name),
      "Upload a .csv or .xlsx file.",
    ),
});

export const batchSchema = z.object({ batchId: z.string().uuid("Choose an OJT batch.") });
export const studentSchema = z.object({ studentId: z.string().uuid("Choose a student.") });
