import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { focusStyle } from "@/components/brand-link";
import { ResumeButton } from "@/components/coordinator/resume-button";
import { StudentEntryList } from "@/components/coordinator/student-entries";
import { RoleBadge, StudentStatusBadge } from "@/components/coordinator/status-badge";
import { DownloadButton } from "@/components/export/download-link";
import { ApplicationStatusBadge } from "@/components/student/application-status";
import { DeploymentStatusBadge } from "@/components/supervisor/student-status";
import { EvaluationView } from "@/components/supervisor/evaluation-view";
import { buttonVariants } from "@/components/ui/button";
import { HoursChain } from "@/components/ui/hours-chain";
import { formatDate } from "@/lib/admin/format";
import { hoursText } from "@/lib/certification/template";
import type { StudentView } from "@/lib/coordinator/student-types";
import { cn } from "@/lib/utils";

// One student, read only, for the coordinator. It takes the data and draws it, so
// the page only has to fetch and check access.
export function StudentScreen({ view }: { view: StudentView }) {
  const { profile, stage, hasResume, applications, deployments } = view;
  const totalHours =
    Math.round(deployments.reduce((sum, deployment) => sum + deployment.approvedHours, 0) * 100) / 100;

  return (
    <>
      <Link
        href="/coordinator/students"
        className={cn(buttonVariants({ variant: "ghost" }), "-ml-2 w-fit", focusStyle)}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to students
      </Link>

      <section
        aria-labelledby="student-heading"
        className="grid gap-6 rounded-3xl border border-border bg-card p-6 shadow-panel sm:p-10"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid min-w-0 gap-1">
            <h1
              id="student-heading"
              className="font-heading text-[28px] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink wrap-break-word sm:text-[36px]"
            >
              {profile.name}
            </h1>
            <p className="font-mono text-[15px] tabular-nums text-copy-muted">{profile.studentNumber}</p>
            <p className="text-[15px] text-copy-muted wrap-break-word">{profile.email}</p>
            <p className="text-sm text-muted-foreground">
              {profile.courseLabel} · batch {profile.batchLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StudentStatusBadge status={stage} />
            {profile.isActive ? null : <RoleBadge role="neutral">Inactive</RoleBadge>}
          </div>
        </div>

        <div className="grid gap-1">
          <p className="text-sm text-muted-foreground">Approved hours</p>
          <p className="font-mono text-[40px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-ink sm:text-[48px]">
            {hoursText(totalHours)}
            <span className="text-base font-normal tracking-normal text-copy-muted">
              {" "}
              of {hoursText(profile.requiredHours)} h
            </span>
          </p>
          <HoursChain approvedHours={totalHours} requiredHours={profile.requiredHours} className="mt-2" />
        </div>

        <ResumeButton studentId={profile.id} hasResume={hasResume} />
      </section>

      {deployments.length === 0 ? (
        <p className="max-w-[62ch] rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-8 text-[15px] leading-[1.6] text-copy-muted">
          {profile.name} has no placement yet. Entries, an evaluation, and the DTR appear here once a
          supervisor accepts an application.
        </p>
      ) : null}

      {deployments.map((deployment) => (
        <section
          key={deployment.id}
          aria-label={`Placement at ${deployment.companyName}`}
          className="grid gap-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="grid gap-1">
              <h2 className="flex flex-wrap items-center gap-x-3 gap-y-1 font-heading text-xl font-bold text-ink">
                <span className="wrap-break-word">{deployment.companyName}</span>
                <DeploymentStatusBadge status={deployment.status} />
              </h2>
              <p className="text-sm tabular-nums text-copy-muted">
                Started {formatDate(deployment.startedAt)} ·{" "}
                <span className="font-mono">{hoursText(deployment.approvedHours)}</span> h approved
                {deployment.pendingEntries > 0
                  ? ` · ${deployment.pendingEntries} ${deployment.pendingEntries === 1 ? "entry" : "entries"} waiting for the supervisor`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <DownloadButton href={`/dtr/${deployment.id}/pdf`}>Download DTR</DownloadButton>
              {deployment.certificationId ? (
                <DownloadButton href={`/certifications/${deployment.certificationId}/pdf`}>
                  Download certificate
                </DownloadButton>
              ) : null}
            </div>
          </div>

          <div className="grid gap-1 rounded-2xl border border-border bg-card p-5 shadow-panel sm:px-6">
            <h3 className="font-heading text-base font-bold text-ink">Work schedule</h3>
            {deployment.schedule ? (
              <ul className="grid gap-1">
                {deployment.schedule.map((line) => (
                  <li key={`${line.days}-${line.times}`} className="flex flex-wrap gap-x-3 text-[15px]">
                    <span className="min-w-28 font-semibold text-ink">{line.days}</span>
                    <span className="font-mono tabular-nums text-copy-muted">{line.times}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[15px] text-copy-muted">No schedule is in force yet.</p>
            )}
          </div>

          <div className="grid gap-3">
            <h3 className="px-1 font-heading text-base font-bold text-ink">Evaluation</h3>
            {deployment.evaluation ? (
              <EvaluationView evaluation={deployment.evaluation} />
            ) : (
              <p className="rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-6 text-[15px] text-copy-muted">
                Not evaluated yet.
              </p>
            )}
          </div>

          <div className="grid gap-3">
            <h3 className="px-1 font-heading text-base font-bold text-ink">
              Daily entries <span className="tabular-nums">({deployment.entries.length})</span>
            </h3>
            <StudentEntryList entries={deployment.entries} />
          </div>
        </section>
      ))}

      <section aria-label="Applications" className="grid gap-3">
        <h2 className="px-1 font-heading text-xl font-bold text-ink">Applications</h2>
        {applications.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-6 text-[15px] text-copy-muted">
            No applications yet.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-panel">
            {applications.map((application) => (
              <li key={application.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-4 sm:px-6">
                <div className="grid min-w-0 gap-0.5">
                  <p className="font-semibold text-ink wrap-break-word">{application.listingTitle}</p>
                  <p className="text-sm text-copy-muted wrap-break-word">
                    {application.companyName} · applied {formatDate(application.appliedAt)}
                  </p>
                </div>
                <ApplicationStatusBadge status={application.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
