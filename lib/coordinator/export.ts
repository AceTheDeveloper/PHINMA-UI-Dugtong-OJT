import { toCsv, type Cell } from "@/lib/export/csv";
import { statusLabels } from "@/lib/coordinator/status";
import type { Dashboard } from "@/lib/coordinator/types";

// The student progress CSV: one row per student of the coordinator's course and
// newest batch, the same rows the dashboard table shows.

export const studentCsvHead = [
  "Name",
  "Student number",
  "Company",
  "Status",
  "Approved hours",
  "Required hours",
  "Pending entries",
  "Last entry date",
] as const;

export function studentCsv(data: Dashboard): string {
  const companyName = new Map(data.companies.map((company) => [company.id, company.name]));
  const rows: Cell[][] = data.students.map((student) => [
    student.name,
    student.studentNumber,
    student.companyId ? (companyName.get(student.companyId) ?? "") : "",
    statusLabels[student.status],
    student.approvedHours,
    data.course.requiredHours,
    student.pendingEntries,
    student.lastEntryDate ?? "",
  ]);
  return toCsv(studentCsvHead, rows);
}

// A file name that is safe on every system: letters, digits, and dashes.
export function studentCsvName(data: Dashboard): string {
  const part = (value: string) => value.replace(/[^A-Za-z0-9-]/g, "");
  return `student-progress-${part(data.course.courseShort) || "course"}-${part(data.course.batchLabel) || "batch"}.csv`;
}
