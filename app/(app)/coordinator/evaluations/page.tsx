import type { Metadata } from "next";
import { EmptyState, LoadError, PageHeader } from "@/components/admin/admin-parts";
import { EvaluationFormEditor } from "@/components/coordinator/evaluation-form-editor";
import { requireRole } from "@/lib/auth/server";
import { getFormsForCourses } from "@/lib/evaluations/queries";

export const metadata: Metadata = {
  title: "Evaluations | Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function CoordinatorEvaluationsPage() {
  // Only the coordinator builds the form; the admin cannot.
  const session = await requireRole(["coordinator"]);
  const forms = await getFormsForCourses(session.courseIds);

  return (
    <>
      <PageHeader
        title="Evaluations"
        description="The form supervisors fill in when a student reaches the required hours. Each criterion is rated from 1 to 5."
      />
      {!forms.ok ? (
        <LoadError message={forms.error.message} />
      ) : forms.data.length === 0 ? (
        <EmptyState>
          You are not assigned to a course yet. Ask the admin to assign you, then build the form here.
        </EmptyState>
      ) : (
        <div className="grid gap-6">
          {forms.data.map((course) => (
            <EvaluationFormEditor key={course.courseId} course={course} />
          ))}
        </div>
      )}
    </>
  );
}
