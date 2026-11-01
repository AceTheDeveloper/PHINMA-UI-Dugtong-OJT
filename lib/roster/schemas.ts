import { z } from "zod";
import { maxFileBytes, maxRosterRows } from "@/lib/roster/parse";

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

// The rows the coordinator is working on, sent back from the preview after
// edits and removals. Length limits are loose on purpose: the roster rules
// (120 characters, 40, a valid email) are applied and reported per row by the
// validator, so an over-long value shows up as a problem, not a refusal.
export const rosterRowsSchema = z.object({
  batchId: z.string().uuid("Choose an OJT batch."),
  rows: z
    .array(
      z.object({
        row: z.number().int().positive(),
        fullName: z.string().max(1000),
        studentNumber: z.string().max(1000),
        email: z.string().max(1000),
      }),
    )
    .min(1, "There are no rows to check. Choose a file.")
    .max(maxRosterRows, `The roster has more than ${maxRosterRows} rows. Split it and import in parts.`)
    .refine(
      (rows) => new Set(rows.map((row) => row.row)).size === rows.length,
      "Each row needs its own row number.",
    ),
});

export const batchSchema = z.object({ batchId: z.string().uuid("Choose an OJT batch.") });
export const studentSchema = z.object({ studentId: z.string().uuid("Choose a student.") });
