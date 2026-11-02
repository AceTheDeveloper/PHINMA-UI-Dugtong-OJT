import type { LogFilters, LogStatusFilter } from "@/lib/coordinator/log-filters";
import type { LogStatus } from "@/lib/logs/types";

// The coordinator's Daily logs screen. Read only: nothing here can be changed
// from the screen, and the coordinator cannot act on an entry (AGENTS.md section 4).

export type LogRow = {
  id: string;
  logDate: string;
  timeIn: string;
  timeOut: string | null;
  breakMinutes: number;
  status: LogStatus;
  journal: string | null;
  rejectReason: string | null;
  earlyOutReason: string | null;
  correctionReason: string | null;
  reopenReason: string | null;
  addedBySupervisor: boolean;
  studentId: string;
  studentName: string;
  studentNumber: string;
  companyName: string;
  // The supervisors who can act on it: name only, the owner first.
  supervisors: string[];
  // Whole days a pending entry has waited; null for any other status.
  daysWaiting: number | null;
  stale: boolean;
  // Timed in on an earlier day and never timed out.
  noTimeOut: boolean;
};

export type LogCounts = Record<Exclude<LogStatusFilter, "all"> | "all", number>;

export type LogsView = {
  course: { courseShort: string; batchLabel: string; staleThresholdDays: number; asOf: string };
  filters: LogFilters;
  // How many entries match every filter, from the database.
  total: number;
  // How many match each status under the other filters, from the database.
  counts: LogCounts;
  rows: LogRow[];
  students: { id: string; name: string }[];
  companies: { id: string; name: string }[];
};
