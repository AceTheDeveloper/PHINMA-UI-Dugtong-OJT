import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LoadError } from "@/components/admin/admin-parts";
import { StudentScreen } from "@/components/coordinator/student-screen";
import { requireRole } from "@/lib/auth/server";
import { getStudentView } from "@/lib/coordinator/student-queries";

export const metadata: Metadata = {
  title: "Student | Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function CoordinatorStudentPage({
  params,
}: {
  params: Promise<{ student: string }>;
}) {
  // Only the coordinator has a course of their own to look into.
  const session = await requireRole(["coordinator"]);
  const { student: studentId } = await params;
  const result = await getStudentView(session.courseIds, studentId);
  if (!result.ok) return <LoadError message={result.error.message} />;
  // Another course's student and a missing one look the same.
  if (!result.data) notFound();

  return <StudentScreen view={result.data} />;
}
