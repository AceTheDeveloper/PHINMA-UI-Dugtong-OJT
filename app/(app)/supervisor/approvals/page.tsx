import type { Metadata } from "next";
import { EmptyState, LoadError, PageHeader } from "@/components/admin/admin-parts";
import { ApprovalQueue, MissingTimeOut } from "@/components/supervisor/approval-queue";
import { requireRole } from "@/lib/auth/server";
import { getReviewQueue } from "@/lib/review/queries";

export const metadata: Metadata = {
  title: "Daily approval · Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function SupervisorApprovalsPage() {
  const session = await requireRole(["supervisor"]);
  const queue = session.companyId ? await getReviewQueue(session.companyId) : null;

  return (
    <>
      <PageHeader
        title="Daily approval"
        description="Entries your students submitted, newest day first. Only approved entries count toward their hours."
      />
      {!queue ? (
        <LoadError message="This account has no company. Contact the admin." />
      ) : !queue.ok ? (
        <LoadError message={queue.error.message} />
      ) : queue.data.pending.length === 0 && queue.data.needsTimeOut.length === 0 ? (
        <EmptyState>
          Nothing is waiting. Entries show up here after a student times out and submits the day.
        </EmptyState>
      ) : (
        <div className="grid gap-8">
          {queue.data.needsTimeOut.length > 0 ? (
            <MissingTimeOut entries={queue.data.needsTimeOut} />
          ) : null}
          {queue.data.pending.length > 0 ? <ApprovalQueue pending={queue.data.pending} /> : null}
        </div>
      )}
    </>
  );
}
