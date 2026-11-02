import type { Metadata } from "next";
import { EmptyState, LoadError, PageHeader } from "@/components/admin/admin-parts";
import { CompaniesList } from "@/components/coordinator/companies-screen";
import { requireRole } from "@/lib/auth/server";
import { getCompaniesView } from "@/lib/coordinator/company-queries";

export const metadata: Metadata = {
  title: "Companies | Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function CoordinatorCompaniesPage() {
  const session = await requireRole(["coordinator"]);
  const result = await getCompaniesView(session.courseIds);

  return (
    <>
      <PageHeader
        title="Companies"
        description="The school's partner companies, with who to contact and how many of your students are placed there. The admin manages them."
      />
      {!result.ok ? (
        <LoadError message={result.error.message} />
      ) : !result.data ? (
        <EmptyState>
          There is no OJT batch to show yet. Ask the admin to assign you to a course and create its
          batch for the school year.
        </EmptyState>
      ) : (
        <CompaniesList view={result.data} />
      )}
    </>
  );
}
