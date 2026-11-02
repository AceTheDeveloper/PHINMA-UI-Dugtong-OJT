import { toCsv, type Cell } from "@/lib/export/csv";
import { statusLabels } from "@/lib/coordinator/status";
import type { DashboardCompany, DashboardStudent } from "@/lib/coordinator/types";

export const adminStudentCsvHead = [
  "Course",
  "Name",
  "Student number",
  "Company",
  "Status",
  "Approved hours",
  "Pending entries",
  "Last entry date",
] as const;

export function adminStudentCsv(
  students: DashboardStudent[],
  companies: DashboardCompany[],
): string {
  const companyName = new Map(companies.map((company) => [company.id, company.name]));
  const rows: Cell[][] = students.map((student) => [
    student.courseCode ?? "",
    student.name,
    student.studentNumber,
    student.companyId ? (companyName.get(student.companyId) ?? "") : "",
    statusLabels[student.status],
    student.approvedHours,
    student.pendingEntries,
    student.lastEntryDate ?? "",
  ]);
  return toCsv(adminStudentCsvHead, rows);
}

export function adminStudentCsvName(): string {
  return "admin-student-progress-all-courses.csv";
}
