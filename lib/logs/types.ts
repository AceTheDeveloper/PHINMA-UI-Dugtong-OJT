// Daily log entries as the student screens see them. Times are ISO timestamps
// from the database clock; dates are school dates (YYYY-MM-DD, Asia/Manila).

export type LogStatus = "open" | "pending" | "approved" | "rejected";

export type LogEntry = {
  id: string;
  logDate: string;
  timeIn: string;
  timeOut: string | null;
  status: LogStatus;
  journal: string | null;
  rejectReason: string | null;
  earlyOutReason: string | null;
  breakMinutes: number;
  // The schedule that applied when the student timed in ("HH:MM"), if any.
  scheduleStart: string | null;
  scheduleEnd: string | null;
  companyName: string;
};

// What the Today panel shows. "entry" means the student already timed in today.
export type TodayView =
  | { kind: "none" }
  | { kind: "no_schedule" }
  | { kind: "off_day" }
  | { kind: "too_early"; opensAt: string }
  | { kind: "ended" }
  | { kind: "ready"; scheduleLabel: string }
  | { kind: "entry"; entry: LogEntry; scheduledEndAt: string | null; scheduledEndLabel: string | null };
