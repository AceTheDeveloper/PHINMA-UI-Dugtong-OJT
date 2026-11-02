import type { Metadata } from "next";
import { EmptyState, LoadError, PageHeader } from "@/components/admin/admin-parts";
import { DownloadButton } from "@/components/export/download-link";
import { LogHistory } from "@/components/student/log-history";
import { requireRole } from "@/lib/auth/server";
import { getDeploymentsOfStudent } from "@/lib/dtr/queries";
import { getLogsForStudent } from "@/lib/logs/queries";

export const metadata: Metadata = {
  title: "Daily log · Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function StudentLogsPage() {
  const session = await requireRole(["student"]);
  const [logs, deployments] = session.studentId
    ? await Promise.all([getLogsForStudent(session.studentId), getDeploymentsOfStudent(session.studentId)])
    : [null, null];

  return (
    <>
      <PageHeader
        title="Daily log"
        description="Your time in, time out, and journal for each day. Only approved entries count toward your hours."
        actions={
          deployments?.ok
            ? deployments.data.map((deployment) => (
                <DownloadButton key={deployment.id} href={`/dtr/${deployment.id}/pdf`}>
                  {deployments.data.length > 1 ? `Download DTR, ${deployment.companyName}` : "Download my DTR"}
                </DownloadButton>
              ))
            : undefined
        }
      />
      {!logs ? (
        <LoadError message="This account has no student record. Contact your coordinator." />
      ) : !logs.ok ? (
        <LoadError message={logs.error.message} />
      ) : logs.data.length === 0 ? (
        <EmptyState>
          No entries yet. Time in from your home page on a working day and it shows up here.
        </EmptyState>
      ) : (
        <LogHistory entries={logs.data} />
      )}
    </>
  );
}
