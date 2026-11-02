import type { Metadata } from "next";
import { LoadError, PageHeader } from "@/components/admin/admin-parts";
import { LogsScreen } from "@/components/coordinator/logs-screen";
import { getAdminLogsView } from "@/lib/admin/log-queries";
import { requireRole } from "@/lib/auth/server";
import { parseLogFilters, type SearchParams } from "@/lib/coordinator/log-filters";

export const metadata: Metadata = {
  title: "Daily logs | Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(["admin"]);
  const filters = parseLogFilters(await searchParams);
  const result = await getAdminLogsView(filters);

  return (
    <>
      <PageHeader
        title="Daily logs"
        description="Every daily entry across all courses and companies, newest first. Approved entries can be reopened as an audited support action."
      />
      {!result.ok ? (
        <LoadError message={result.error.message} />
      ) : (
        <LogsScreen
          view={result.data}
          basePath="/admin/logs"
          studentBasePath="/admin/students"
          canReopen={true}
        />
      )}
    </>
  );
}
