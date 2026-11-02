import { z } from "zod";

// Input to the set-schedule action. Everything comes from the browser, so it is
// checked here; the database checks the company and the dates again.

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter times as hours and minutes.");

const day = z.object({
  weekday: z.number().int().min(1).max(7),
  start: time,
  end: time,
});

export const setScheduleSchema = z.object({
  deploymentId: z.string().uuid("Choose a student."),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date the schedule starts."),
  days: z
    .array(day)
    .min(1, "Choose at least one working day.")
    .max(7)
    .superRefine((days, context) => {
      const seen = new Set<number>();
      for (const item of days) {
        if (seen.has(item.weekday)) {
          context.addIssue({ code: "custom", message: "Each weekday can be chosen once." });
          return;
        }
        seen.add(item.weekday);
        if (item.start === item.end) {
          context.addIssue({
            code: "custom",
            message: "Start and end times cannot be the same.",
          });
          return;
        }
      }
    }),
});

export type SetScheduleInput = z.infer<typeof setScheduleSchema>;
