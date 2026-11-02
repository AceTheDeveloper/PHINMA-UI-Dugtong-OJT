import { z } from "zod";

// Input to the supervisor's daily approval actions. Ids, times, and text come
// from the browser, so they are checked here; the database checks the company,
// the status, and the dates again. Times are school clock times ("HH:MM").

const logId = z.string().uuid("Choose an entry.");
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter times as hours and minutes.");
const breakMinutes = z
  .number("Enter the break in minutes.")
  .int("Enter the break in whole minutes.")
  .min(0, "The break cannot be negative.")
  .max(1440, "The break is too long.");

export const maxReasonLength = 500;

const reason = (what: string) =>
  z
    .string(`Give a reason ${what}.`)
    .trim()
    .min(1, `Give a reason ${what}.`)
    .max(maxReasonLength, "The reason is too long. Shorten it and try again.");

export const approveSchema = z.object({ logId });

export const bulkApproveSchema = z.object({
  logIds: z
    .array(logId)
    .min(1, "Choose at least one entry.")
    .max(200, "Choose 200 entries or fewer."),
});

export const rejectSchema = z.object({
  logId,
  reason: reason("so the student knows what to fix"),
});

export const correctSchema = z.object({
  logId,
  timeIn: clock,
  timeOut: clock,
  breakMinutes,
  reason: reason("for the correction"),
});

export const reopenSchema = z.object({
  logId,
  reason: reason("for reopening the entry"),
});

export const missedDaySchema = z.object({
  deploymentId: z.string().uuid("Choose a student."),
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the day."),
  timeIn: clock,
  timeOut: clock,
  breakMinutes,
  reason: reason("for adding the day"),
});
