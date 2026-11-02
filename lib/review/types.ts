import type { LogEntry } from "@/lib/logs/types";

// An entry as the supervisor sees it: the student's entry plus who it belongs to
// and what the supervisor recorded about it.
export type ReviewEntry = LogEntry & {
  deploymentId: string;
  studentName: string;
  studentNumber: string;
  correctionReason: string | null;
  reopenReason: string | null;
  // The supervisor recorded this day for a student who never timed in.
  addedBySupervisor: boolean;
};

export type ReviewQueue = {
  // Entries the student submitted that wait for a decision, newest day first.
  pending: ReviewEntry[];
  // Entries from an earlier day that were never closed: the time out is missing.
  needsTimeOut: ReviewEntry[];
};
