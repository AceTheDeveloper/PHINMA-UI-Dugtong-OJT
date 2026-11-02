import type { Metadata } from "next";
import { EmptyState, LoadError, PageHeader } from "@/components/admin/admin-parts";
import { StudentTable } from "@/components/coordinator/student-table";
import { requireRole } from "@/lib/auth/server";
import { getAdminStudentsList } from "@/lib/admin/student-queries";

export const metadata: Metadata = {
  title: "Students | Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function AdminStudentsPage() {
  await requireRole(["admin"]);
  const result = await getAdminStudentsList();

  return (
    <>
      <PageHeader
        title="Students"
        description="All students across every course. Open a student to view their entries, evaluation, and downloads."
      />
      {!result.ok ? (
        <LoadError message={result.error.message} />
      ) : result.data.students.length === 0 ? (
        <EmptyState>No students yet. Import a student roster first.</EmptyState>
      ) : (
        <StudentTable
          students={result.data.students}
          companies={result.data.companies}
          courses={result.data.courses}
          requiredHours={result.data.requiredHours}
          basePath="/admin/students"
        />
      )}
    </>
  );
}
