import type { Metadata } from "next";
import { EmptyState, LoadError, PageHeader } from "@/components/admin/admin-parts";
import { ApplicantList } from "@/components/supervisor/applicant-list";
import { getApplicantsForCompany } from "@/lib/applicants/queries";
import { requireRole } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Applicants · Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function SupervisorApplicantsPage() {
  const session = await requireRole(["supervisor"]);
  const applicants = session.companyId
    ? await getApplicantsForCompany(session.companyId)
    : null;

  return (
    <>
      <PageHeader
        title="Applicants"
        description="Students who applied to your listings. Applicants waiting for a decision come first."
      />
      {!applicants ? (
        <LoadError message="This account has no company. Contact the admin." />
      ) : !applicants.ok ? (
        <LoadError message={applicants.error.message} />
      ) : applicants.data.length === 0 ? (
        <EmptyState>
          No one has applied yet. Applicants appear here once students apply to your listings.
        </EmptyState>
      ) : (
        <ApplicantList applicants={applicants.data} />
      )}
    </>
  );
}
