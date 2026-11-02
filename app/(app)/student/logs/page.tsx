import type { Metadata } from "next";
import { EmptyState, LoadError, PageHeader } from "@/components/admin/admin-parts";
import { LogHistory } from "@/components/student/log-history";
import { requireRole } from "@/lib/auth/server";
import { getLogsForStudent } from "@/lib/logs/queries";

export const metadata: Metadata = {
  title: "Daily log · Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function StudentLogsPage() {
  const session = await requireRole(["student"]);
  const logs = session.studentId ? await getLogsForStudent(session.studentId) : null;

  return (
    <>
      <PageHeader
        title="Daily log"
        description="Your time in, time out, and journal for each day. Only approved entries count toward your hours."
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
