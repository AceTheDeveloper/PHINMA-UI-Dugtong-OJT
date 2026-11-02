import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, LoadError, PageHeader } from "@/components/admin/admin-parts";
import { ReopenEvaluationDialog } from "@/components/admin/reopen-evaluation-dialog";
import { focusStyle } from "@/components/brand-link";
import { RoleBadge } from "@/components/coordinator/status-badge";
import { DownloadButton } from "@/components/export/download-link";
import { formatDate } from "@/lib/admin/format";
import { getAdminEvaluations } from "@/lib/admin/evaluation-queries";
import { requireRole } from "@/lib/auth/server";
import { hoursText } from "@/lib/certification/template";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Evaluations | Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function AdminEvaluationsPage() {
  await requireRole(["admin"]);
  const result = await getAdminEvaluations();

  return (
    <>
      <PageHeader
        title="Evaluations"
        description="All final evaluations submitted by company supervisors across all students and companies. Reopening an evaluation is an audited support action."
      />

      {!result.ok ? (
        <LoadError message={result.error.message} />
      ) : result.data.length === 0 ? (
        <EmptyState>
          No evaluations have been submitted yet. Submitted evaluations will appear here.
        </EmptyState>
      ) : (
        <div className="grid gap-8">
          <p role="status" className="text-[15px] text-copy-muted">
            <span className="font-semibold tabular-nums text-ink">{result.data.length}</span>{" "}
            {result.data.length === 1 ? "evaluation" : "evaluations"} submitted across all courses.
          </p>

          <div className="grid gap-6">
            {result.data.map((item) => (
              <section
                key={item.id}
                aria-label={`Evaluation for ${item.studentName}`}
                className="grid gap-5 rounded-3xl border border-border bg-card p-6 shadow-panel sm:p-8"
              >
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                  <div className="grid min-w-0 gap-1">
                    <h2 className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <Link
                        href={`/admin/students/${item.studentId}`}
                        className={cn(
                          "font-heading text-xl font-bold leading-tight text-ink underline-offset-4 hover:underline wrap-break-word",
                          focusStyle,
                        )}
                      >
                        {item.studentName}
                      </Link>
                      <span className="font-mono text-sm tabular-nums text-copy-muted">
                        {item.studentNumber}
                      </span>
                    </h2>
                    <p className="text-[15px] text-copy-muted wrap-break-word">
                      {item.companyName} · Evaluated by {item.evaluatorName} on{" "}
                      <span className="tabular-nums">{formatDate(item.submittedAt)}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-mono tabular-nums">{hoursText(item.approvedHours)}</span> of{" "}
                      <span className="font-mono tabular-nums">{hoursText(item.requiredHours)}</span> hours
                      approved · Form version {item.formVersion}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {item.certificationStatus === "issued" ? (
                      <RoleBadge role="teal">Certified</RoleBadge>
                    ) : (
                      <RoleBadge role="neutral">Evaluated</RoleBadge>
                    )}
                    {item.certificationId && item.certificationStatus === "issued" ? (
                      <DownloadButton href={`/certifications/${item.certificationId}/pdf`}>
                        Certificate PDF
                      </DownloadButton>
                    ) : null}
                    <ReopenEvaluationDialog
                      evaluationId={item.id}
                      studentName={item.studentName}
                    />
                  </div>
                </div>

                <div className="grid gap-3">
                  <h3 className="px-1 text-sm font-semibold text-copy-muted">Criterion scores</h3>
                  <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-xs">
                    {item.scores.map((scoreItem, index) => (
                      <li key={scoreItem.label} className="grid gap-1.5 px-5 py-3.5 sm:px-6">
                        <div className="flex items-start justify-between gap-4">
                          <p className="flex gap-3 text-[15px] font-semibold leading-[1.5] text-ink">
                            <span className="w-5 shrink-0 text-right font-mono tabular-nums text-copy-muted">
                              {index + 1}
                            </span>
                            <span className="wrap-break-word">{scoreItem.label}</span>
                          </p>
                          <p
                            className="shrink-0 font-mono text-base font-semibold tabular-nums text-ink"
                            aria-label={`${scoreItem.score} out of 5`}
                          >
                            {scoreItem.score}
                            <span className="text-xs font-normal text-copy-muted"> / 5</span>
                          </p>
                        </div>
                        {scoreItem.comment ? (
                          <p className="whitespace-pre-wrap text-sm text-copy-muted sm:pl-8 wrap-break-word">
                            {scoreItem.comment}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>

                {item.overallComment ? (
                  <div className="grid gap-1.5 px-1">
                    <h3 className="text-sm font-semibold text-ink">Overall comment</h3>
                    <p className="max-w-[62ch] whitespace-pre-wrap text-[15px] leading-[1.6] text-copy-muted wrap-break-word">
                      {item.overallComment}
                    </p>
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
