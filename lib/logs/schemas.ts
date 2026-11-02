import { z } from "zod";

// Input to the student's daily log actions. Ids and text come from the browser,
// so they are checked here. No time is ever accepted: the database clock sets
// time in and time out.

export const maxJournalLength = 4000;
export const maxReasonLength = 500;

const logId = z.string().uuid("Choose an entry.");

const journalDraft = z
  .string("Write your journal.")
  .max(maxJournalLength, "The journal is too long. Shorten it and try again.");

const journalToSubmit = (action: string) =>
  z
    .string(`Write a short journal before you ${action}.`)
    .trim()
    .min(1, `Write a short journal before you ${action}.`)
    .max(maxJournalLength, "The journal is too long. Shorten it and try again.");

export const saveJournalSchema = z.object({ logId, journal: journalDraft });

export const timeOutSchema = z.object({
  logId,
  journal: journalToSubmit("time out"),
  earlyOutReason: z
    .string()
    .trim()
    .max(maxReasonLength, "The reason is too long. Shorten it and try again.")
    .optional(),
});

export const resubmitSchema = z.object({ logId, journal: journalToSubmit("resubmit") });
