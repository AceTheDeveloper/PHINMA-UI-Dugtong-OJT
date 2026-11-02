import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LoadError } from "@/components/admin/admin-parts";
import { focusStyle } from "@/components/brand-link";
import { RoleBadge } from "@/components/coordinator/status-badge";
import { EvaluationForm } from "@/components/supervisor/evaluation-form";
import { EvaluationView } from "@/components/supervisor/evaluation-view";
import { buttonVariants } from "@/components/ui/button";
import { HoursChain } from "@/components/ui/hours-chain";
import { requireRole } from "@/lib/auth/server";
import { getEvaluationDetail } from "@/lib/evaluations/supervisor";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Evaluation · Dugtong OJT",
  robots: { index: false, follow: false },
};

function hoursText(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="max-w-[62ch] rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-8 text-[15px] leading-[1.6] text-copy-muted">
      {children}
    </p>
  );
}

export default async function SupervisorEvaluationPage({
  params,
}: {
  params: Promise<{ deployment: string }>;
}) {
  const session = await requireRole(["supervisor"]);
  if (!session.companyId) {
    return <LoadError message="This account has no company. Contact the admin." />;
  }
  const { deployment } = await params;
  const result = await getEvaluationDetail(session.companyId, deployment);
  if (!result.ok) {
    if (result.error.code === "not_found") notFound();
    return <LoadError message={result.error.message} />;
  }
  const student = result.data;
  const remaining = student.requiredHours - student.approvedHours;
  const reached = remaining <= 0;

  return (
    <>
      <Link
        href="/supervisor/evaluations"
        className={cn(buttonVariants({ variant: "ghost" }), "-ml-2 w-fit", focusStyle)}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to evaluations
      </Link>

      <section
        aria-labelledby="evaluation-heading"
        className="grid gap-5 rounded-3xl border border-border bg-card p-6 shadow-panel sm:p-10"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid min-w-0 gap-1">
            <h1
              id="evaluation-heading"
              className="font-heading text-[28px] font-bold leading-[1.1] tracking-[-0.03em] text-ink wrap-break-word sm:text-[36px]"
            >
              {student.studentName}
            </h1>
            <p className="font-mono text-[15px] tabular-nums text-copy-muted">
              {student.studentNumber}
            </p>
          </div>
          {student.submitted ? (
            <RoleBadge role="teal">Evaluated</RoleBadge>
          ) : reached && student.status === "active" ? (
            <RoleBadge role="teal">Ready</RoleBadge>
          ) : null}
        </div>
        <div className="grid gap-1">
          <p className="text-sm text-muted-foreground">Approved hours</p>
          <p className="font-mono text-[15px] tabular-nums text-ink">
            {hoursText(student.approvedHours)} of {hoursText(student.requiredHours)} h
          </p>
          <HoursChain
            size="sm"
            approvedHours={student.approvedHours}
            requiredHours={student.requiredHours}
          />
        </div>
      </section>

      {student.submitted ? (
        <EvaluationView evaluation={student.submitted} />
      ) : student.status !== "active" ? (
        <Notice>This deployment is no longer active, so it cannot be evaluated.</Notice>
      ) : !reached ? (
        <Notice>
          {student.studentName} needs {hoursText(remaining)} more approved hours before you can
          evaluate them.
          {student.pendingEntries > 0
            ? ` ${student.pendingEntries} ${
                student.pendingEntries === 1 ? "entry is" : "entries are"
              } still pending. Approve ${student.pendingEntries === 1 ? "it" : "them"} first if the hours are right.`
            : ""}
        </Notice>
      ) : !student.form ? (
        <Notice>
          Your coordinator has not published the evaluation form yet. You can evaluate{" "}
          {student.studentName} once they do.
        </Notice>
      ) : (
        <section aria-label="Evaluation form" className="grid gap-5">
          {student.pendingEntries > 0 ? (
            <p className="rounded-lg border border-warning-border bg-warning-tint px-3 py-2 text-sm text-warning-text">
              {student.pendingEntries} {student.pendingEntries === 1 ? "entry is" : "entries are"} still
              pending. Approving {student.pendingEntries === 1 ? "it" : "them"} first makes the hours on
              the certification right.
            </p>
          ) : null}
          <EvaluationForm
            deploymentId={student.deploymentId}
            studentName={student.studentName}
            criteria={student.form.criteria}
          />
        </section>
      )}
    </>
  );
}
