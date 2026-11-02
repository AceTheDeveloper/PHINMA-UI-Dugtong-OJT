import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LoadError } from "@/components/admin/admin-parts";
import { StudentScreen } from "@/components/coordinator/student-screen";
import { getAllCourseIds } from "@/lib/admin/queries";
import { requireRole } from "@/lib/auth/server";
import { getStudentView } from "@/lib/coordinator/student-queries";

export const metadata: Metadata = {
  title: "Student | Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function AdminStudentDetailPage({
  params,
}: {
  params: Promise<{ student: string }>;
}) {
  await requireRole(["admin"]);
  const { student: studentId } = await params;

  const courses = await getAllCourseIds();
  if (!courses.ok) return <LoadError message={courses.error.message} />;

  const result = await getStudentView(courses.data, studentId);
  if (!result.ok) return <LoadError message={result.error.message} />;
  if (!result.data) notFound();

  return (
    <StudentScreen
      view={result.data}
      showResume={false}
      backHref="/admin/students"
    />
  );
}
