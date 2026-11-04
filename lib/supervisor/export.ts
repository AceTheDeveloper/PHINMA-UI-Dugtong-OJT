import { toCsv, type Cell } from "@/lib/export/csv";
import { statusLabels, studentStatus } from "@/lib/coordinator/status";
import { manilaToday } from "@/lib/schedules/logic";

// The supervisor's student progress CSV (ticket-34): one row per deployment at
// the supervisor's company, active, completed, and ended. Only what the
// students page already shows: no email, phone, resume, or journal.

export const supervisorCsvHead = [
  "Student name",
  "Student number",
  "Course",
  "Status",
  "Start date",
  "Approved hours",
  "Required hours",
  "Pending entries",
  "Last entry date",
] as const;

export type ExportDeployment = {
  studentName: string;
  studentNumber: string;
  courseCode: string;
  status: "active" | "completed" | "ended";
  // When the deployment started (an ISO timestamp); shown as a school date.
  startedAt: string;
  approvedHours: number;
  requiredHours: number;
  pendingEntries: number;
  lastEntryDate: string | null;
};

// "Ready for evaluation" is the coordinator's rule too: an active deployment
// whose approved hours reached the required hours.
function statusLabel(row: ExportDeployment): string {
  return statusLabels[
    studentStatus({
      deployments: [{ status: row.status }],
      openApplications: 0,
      approvedHours: row.approvedHours,
      requiredHours: row.requiredHours,
    })
  ];
}

// Active first, then by name, as on the students page.
export function sortDeployments(rows: readonly ExportDeployment[]): ExportDeployment[] {
  return [...rows].sort(
    (a, b) =>
      Number(b.status === "active") - Number(a.status === "active") ||
      a.studentName.localeCompare(b.studentName),
  );
}

export function supervisorCsv(rows: readonly ExportDeployment[]): string {
  const cells: Cell[][] = sortDeployments(rows).map((row) => [
    row.studentName,
    row.studentNumber,
    row.courseCode,
    statusLabel(row),
    manilaToday(new Date(row.startedAt)),
    row.approvedHours,
    row.requiredHours,
    row.pendingEntries,
    row.lastEntryDate ?? "",
  ]);
  return toCsv(supervisorCsvHead, cells);
}

// A file name that is safe on every system: letters, digits, and dashes. The
// date is today in Asia/Manila.
export function supervisorCsvName(companyName: string, now: Date = new Date()): string {
  const company = companyName
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `student-progress-${company || "company"}-${manilaToday(now)}.csv`;
}
