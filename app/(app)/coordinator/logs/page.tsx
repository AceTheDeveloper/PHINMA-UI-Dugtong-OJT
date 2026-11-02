import type { Metadata } from "next";
import { EmptyState, LoadError, PageHeader } from "@/components/admin/admin-parts";
import { LogsScreen } from "@/components/coordinator/logs-screen";
import { requireRole } from "@/lib/auth/server";
import { parseLogFilters, type SearchParams } from "@/lib/coordinator/log-filters";
import { getLogsView } from "@/lib/coordinator/log-queries";

export const metadata: Metadata = {
  title: "Daily logs | Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function CoordinatorLogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireRole(["coordinator"]);
  const filters = parseLogFilters(await searchParams);
  const result = await getLogsView(session.courseIds, filters);

  return (
    <>
      <PageHeader
        title="Daily logs"
        description={
          result.ok && result.data
            ? `Every entry of the ${result.data.course.courseShort} batch ${result.data.course.batchLabel}, newest first. You can read them here; the supervisor approves.`
            : "Every entry of your batch, newest first. You can read them here; the supervisor approves."
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
        <LogsScreen view={result.data} />
      )}
    </>
  );
}
