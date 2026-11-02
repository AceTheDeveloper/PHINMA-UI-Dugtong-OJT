import type { Metadata } from "next";
import { EmptyState, LoadError, PageHeader } from "@/components/admin/admin-parts";
import { ApplicationList } from "@/components/student/application-list";
import { getApplicationsForStudent } from "@/lib/applications/queries";
import { requireRole } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Applications · Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function StudentApplicationsPage() {
  const session = await requireRole(["student"]);
  const applications = session.studentId
    ? await getApplicationsForStudent(session.studentId)
    : null;

  return (
    <>
      <PageHeader
        title="Applications"
        description="Where each of your applications stands."
      />
      {!applications ? (
        <LoadError message="This account has no student record. Contact your coordinator." />
      ) : !applications.ok ? (
        <LoadError message={applications.error.message} />
      ) : applications.data.length === 0 ? (
        <EmptyState>You have not applied to any listing yet. Browse the listings to start.</EmptyState>
      ) : (
        <ApplicationList applications={applications.data} />
      )}
    </>
  );
}
