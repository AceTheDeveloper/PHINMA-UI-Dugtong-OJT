import type { Metadata } from "next";
import { EmptyState, LoadError, PageHeader } from "@/components/admin/admin-parts";
import { AuditScreen } from "@/components/coordinator/audit-screen";
import { requireRole } from "@/lib/auth/server";
import { parseAuditFilters } from "@/lib/coordinator/audit-filters";
import { getAuditView } from "@/lib/coordinator/audit-queries";
import type { SearchParams } from "@/lib/coordinator/log-filters";

export const metadata: Metadata = {
  title: "Audit log | Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function CoordinatorAuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireRole(["coordinator"]);
  const filters = parseAuditFilters(await searchParams);
  const result = await getAuditView(session.courseIds, filters);

  return (
    <>
      <PageHeader
        title="Audit log"
        description={
          result.ok && result.data
            ? `What changed in the ${result.data.course.courseShort} batch ${result.data.course.batchLabel}: decisions on entries, evaluations, certifications, placements, required hours, and the roster. Newest first.`
            : "What changed in your batch, newest first."
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
        <AuditScreen view={result.data} />
      )}
    </>
  );
}
