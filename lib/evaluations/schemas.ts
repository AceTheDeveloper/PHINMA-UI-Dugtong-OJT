import { z } from "zod";

// Input to the evaluation form actions. Ids and text come from the browser, so
// they are checked here; the database checks the course, the status, and the
// rules for criteria again.

export const maxCriteria = 30;
export const maxCriterionLength = 200;

const formId = z.string().uuid("Choose a form.");

export const createDraftSchema = z.object({
  courseId: z.string().uuid("Choose a course."),
});

export const saveDraftSchema = z.object({
  formId,
  criteria: z
    .array(
      z
        .string("Write each criterion as text.")
        .trim()
        .min(1, "A criterion cannot be empty.")
        .max(maxCriterionLength, "A criterion can be up to 200 characters."),
    )
    .max(maxCriteria, "A form can have up to 30 criteria.")
    .superRefine((labels, context) => {
      const seen = new Set<string>();
      for (const label of labels) {
        const key = label.toLowerCase();
        if (seen.has(key)) {
          context.addIssue({ code: "custom", message: "Two criteria have the same name." });
          return;
        }
        seen.add(key);
      }
    }),
});

export const formIdSchema = z.object({ formId });

// Publishing saves the criteria first, so the published form is what is on screen.
export const publishSchema = saveDraftSchema.extend({
  criteria: saveDraftSchema.shape.criteria.min(1, "Add at least one criterion before you publish."),
});
