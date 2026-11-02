import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, ChevronRight, ClipboardCheck, Users } from "lucide-react";
import { LoadError } from "@/components/admin/admin-parts";
import { buttonVariants } from "@/components/ui/button";
import { focusStyle } from "@/components/brand-link";
import { RoleBadge } from "@/components/coordinator/status-badge";
import { getSupervisorSummary } from "@/lib/applicants/queries";
import { requireRole } from "@/lib/auth/server";
import { getReviewQueue } from "@/lib/review/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Supervisor home · Dugtong OJT",
  robots: { index: false, follow: false },
};

function Row({
  href,
  icon,
  title,
  note,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  note: string;
  badge: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-[72px] items-center gap-4 px-5 py-4 transition-colors hover:bg-surface sm:px-6",
        focusStyle,
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-tint text-primary"
      >
        {icon}
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="font-heading text-[17px] font-bold leading-tight text-ink">{title}</span>
        <span className="text-[15px] leading-snug text-copy-muted">{note}</span>
      </span>
      {badge}
      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-faint" />
    </Link>
  );
}

export default async function SupervisorHomePage() {
  const session = await requireRole(["supervisor"]);
  const [result, queue] = session.companyId
    ? await Promise.all([getSupervisorSummary(session.companyId), getReviewQueue(session.companyId)])
    : [null, null];
  const waitingEntries = queue?.ok ? queue.data.pending.length + queue.data.needsTimeOut.length : 0;

  if (!result) return <LoadError message="This account has no company. Contact the admin." />;
  if (!result.ok) return <LoadError message={result.error.message} />;
  const summary = result.data;
  const waiting = summary.waitingApplicants;

  const entriesLabel = waitingEntries === 1 ? "entry is" : "entries are";
  const applicantsLabel = waiting === 1 ? "applicant is" : "applicants are";

  return (
    <>
      <section
        aria-labelledby="supervisor-heading"
        className="overflow-hidden rounded-3xl border border-deep-border shadow-panel"
      >
        <div className="grid gap-5 bg-deep p-6 text-deep-foreground sm:p-10">
          <h1
            id="supervisor-heading"
            className="font-heading text-[30px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[40px]"
          >
            {summary.companyName}
          </h1>
          <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
            <p className="font-heading text-[56px] font-bold leading-none tabular-nums tracking-[-0.04em] sm:text-[72px]">
              {waitingEntries}
            </p>
            <p className="pb-1.5 text-[15px] text-deep-muted sm:pb-2.5 sm:text-base">
              {entriesLabel} waiting for your approval
            </p>
          </div>
          <div>
            <Link
              href="/supervisor/approvals"
              className={cn(
                "inline-flex h-14 items-center justify-center rounded-lg bg-deep-action px-8 text-base font-semibold text-deep-action-foreground transition-opacity hover:opacity-90",
                focusStyle,
              )}
            >
              {waitingEntries > 0 ? "Review entries" : "See approvals"}
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 bg-card px-6 py-4 sm:px-10">
          <p className="text-[15px] text-copy-muted">
            <span className="font-semibold tabular-nums text-ink">{waiting}</span> {applicantsLabel} waiting
            for your decision
          </p>
          <Link
            href="/supervisor/applicants"
            className={cn(buttonVariants({ variant: "outline" }), "h-11 px-5 text-[15px]", focusStyle)}
          >
            {waiting > 0 ? "Review applicants" : "See applicants"}
          </Link>
        </div>
      </section>

      <section
        aria-label="Your company"
        className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-panel"
      >
        <Row
          href="/supervisor/listings"
          icon={<Briefcase className="size-5" />}
          title="Listings"
          note="Students see your open listings when they browse. Close one when it is full."
          badge={
            <RoleBadge role={summary.openListings > 0 ? "success" : "neutral"}>
              <span className="tabular-nums">{summary.openListings}</span>&nbsp;open
            </RoleBadge>
          }
        />
        <Row
          href="/supervisor/approvals"
          icon={<ClipboardCheck className="size-5" />}
          title="Daily approval"
          note={
            waitingEntries === 0
              ? "Nothing is waiting. Entries appear here after a student submits the day."
              : "Approve, reject, or correct what your students submitted."
          }
          badge={
            waitingEntries > 0 ? (
              <RoleBadge role="warning">
                <span className="tabular-nums">{waitingEntries}</span>&nbsp;waiting
              </RoleBadge>
            ) : null
          }
        />
        <Row
          href="/supervisor/students"
          icon={<Users className="size-5" />}
          title="Students"
          note={
            summary.activeStudents === 0
              ? "No student is deployed with your company yet."
              : `${summary.activeStudents} ${
                  summary.activeStudents === 1 ? "student is" : "students are"
                } deployed with your company.`
          }
          badge={
            summary.activeStudents > 0 ? (
              <RoleBadge role="success">
                <span className="tabular-nums">{summary.activeStudents}</span>&nbsp;active
              </RoleBadge>
            ) : null
          }
        />
      </section>
    </>
  );
}
