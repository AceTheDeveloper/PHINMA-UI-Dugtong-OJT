// The shapes the coordinator dashboard shows. They come from real rows (see
// lib/coordinator/queries.ts); the components read only these.

export type StudentStatus =
  | "active"
  | "ready"
  | "completed"
  | "applying"
  | "no-application"
  | "ended";

export type DashboardStudent = {
  id: string;
  name: string;
  studentNumber: string;
  companyId: string | null;
  // The deployment the DTR is for: the active one, else a completed one, else the latest.
  deploymentId: string | null;
  status: StudentStatus;
  approvedHours: number;
  pendingEntries: number;
  lastEntryDate: string | null;
  courseId?: string;
  courseCode?: string;
};

export type DashboardCompany = {
  id: string;
  name: string;
  supervisors: number;
};

export type PendingEntry = {
  id: string;
  studentId: string;
  date: string;
  daysWaiting: number;
};

export type OpenEntry = {
  id: string;
  studentId: string;
  date: string;
};

export type Activity = {
  id: string;
  text: string;
  at: string;
};

// The course and OJT batch the dashboard is about. The school, department, and
// course names, the required hours, and the stale threshold are data, never
// constants in code.
export type CourseInfo = {
  // The OJT batch the page shows; the coordinator's required-hours form edits it.
  batchId: string;
  school: string;
  department: string;
  departmentShort: string;
  course: string;
  courseShort: string;
  batchLabel: string;
  requiredHours: number;
  staleThresholdDays: number;
  // Today in school time (YYYY-MM-DD).
  asOf: string;
};

export type WeeklyHours = { weekStart: string; hours: number };

export type Dashboard = {
  course: CourseInfo;
  // Set when the coordinator has more than one course: only the first is shown.
  otherCourses: number;
  students: DashboardStudent[];
  companies: DashboardCompany[];
  pending: PendingEntry[];
  open: OpenEntry[];
  activity: Activity[];
  weekly: WeeklyHours[];
};
