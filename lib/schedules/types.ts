// A supervisor-set work schedule. Weekdays are ISO numbers: 1 is Monday and 7
// is Sunday. Times are "HH:MM" in the school timezone. An end earlier than the
// start means the shift ends the next day.

export type ScheduleDay = { weekday: number; start: string; end: string };

export type WorkSchedule = {
  id: string;
  effectiveFrom: string; // YYYY-MM-DD
  days: ScheduleDay[];
};

export type StudentRow = {
  deploymentId: string;
  status: "active" | "completed" | "ended";
  studentName: string;
  studentNumber: string;
  approvedHours: number;
  requiredHours: number;
  // Short text of the schedule in force today, or null when none has started.
  scheduleSummary: string | null;
};

export type StudentDetail = {
  deploymentId: string;
  status: "active" | "completed" | "ended";
  studentName: string;
  studentNumber: string;
  approvedHours: number;
  requiredHours: number;
  schedules: WorkSchedule[];
};
