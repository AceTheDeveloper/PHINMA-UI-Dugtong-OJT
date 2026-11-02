import { z } from "zod";

// Input to the save-signatories action. The database checks the course and who
// may change it again.

export const maxSignatoryLength = 100;

const text = (what: string) =>
  z
    .string(`Enter ${what}.`)
    .trim()
    .min(1, `Enter ${what}.`)
    .max(maxSignatoryLength, "A name or title can be up to 100 characters.");

export const saveTemplateSchema = z.object({
  courseId: z.string().uuid("Choose a course."),
  signatory1Name: text("the first signatory's name"),
  signatory1Title: text("the first signatory's title"),
  signatory2Name: text("the second signatory's name"),
  signatory2Title: text("the second signatory's title"),
});
