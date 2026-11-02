import type { Metadata } from "next";
import { EmptyState, LoadError, PageHeader } from "@/components/admin/admin-parts";
import { StudentTable } from "@/components/coordinator/student-table";
import { requireRole } from "@/lib/auth/server";
import { getDashboard } from "@/lib/coordinator/queries";

export const metadata: Metadata = {
  title: "Students | Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function CoordinatorStudentsPage() {
  const session = await requireRole(["coordinator"]);
  const result = await getDashboard(session.courseIds);

  return (
    <>
      <PageHeader
        title="Students"
        description={
          result.ok && result.data
            ? `Everyone in the ${result.data.course.courseShort} batch ${result.data.course.batchLabel}. Open a student to read their entries, evaluation, and downloads.`
            : "Everyone in your batch. Open a student to read their entries, evaluation, and downloads."
        }
      />
      {!result.ok ? (
        <LoadError message={result.error.message} />
      ) : !result.data ? (
        <EmptyState>
          There is no OJT batch to show yet. Ask the admin to assign you to a course and create its
          batch for the school year.
        </EmptyState>
      ) : (
        <StudentTable
          students={result.data.students}
          companies={result.data.companies}
          requiredHours={result.data.course.requiredHours}
        />
      )}
    </>
  );
}
