import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { EmptyState, LoadError, PageHeader } from "@/components/admin/admin-parts";
import { focusStyle } from "@/components/brand-link";
import { RoleBadge } from "@/components/coordinator/status-badge";
import { HoursChain } from "@/components/ui/hours-chain";
import { formatDate } from "@/lib/admin/format";
import { requireRole } from "@/lib/auth/server";
import { getEvaluationQueue } from "@/lib/evaluations/supervisor";
import type { EvaluationQueueRow } from "@/lib/evaluations/supervisor-types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Evaluations · Dugtong OJT",
  robots: { index: false, follow: false },
};

function hoursText(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function note(row: EvaluationQueueRow): string {
  if (row.evaluatedAt) return `Evaluated on ${formatDate(row.evaluatedAt)}`;
  const parts: string[] = [];
  if (row.ready) {
    parts.push("Reached the required hours");
  } else {
    parts.push(`${hoursText(row.requiredHours - row.approvedHours)} h to go`);
  }
  if (row.pendingEntries > 0) {
    parts.push(
      `${row.pendingEntries} ${row.pendingEntries === 1 ? "entry" : "entries"} still pending`,
    );
  }
  return parts.join(" · ");
}

function Group({ title, rows }: { title: string; rows: EvaluationQueueRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section aria-label={title} className="grid gap-2">
      <h2 className="px-1 text-[15px] font-semibold text-copy-muted">
        {title} <span className="tabular-nums">({rows.length})</span>
      </h2>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-panel">
        {rows.map((row) => (
          <li key={row.deploymentId}>
            <Link
              href={`/supervisor/evaluations/${row.deploymentId}`}
              className={cn(
                "flex min-h-[88px] items-center gap-4 px-5 py-4 transition-colors hover:bg-surface sm:px-6",
                focusStyle,
              )}
            >
              <span className="grid min-w-0 flex-1 gap-1">
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-heading text-[17px] font-bold leading-tight text-ink wrap-break-word">
                    {row.studentName}
                  </span>
                  {row.evaluatedAt ? (
                    <RoleBadge role="teal">Evaluated</RoleBadge>
                  ) : row.ready ? (
                    <RoleBadge role="teal">Ready</RoleBadge>
                  ) : null}
                </span>
                <span className="text-[15px] text-copy-muted wrap-break-word">
                  <span className="font-mono tabular-nums">{row.studentNumber}</span>
                  {" · "}
                  {note(row)}
                </span>
              </span>
              <span className="max-sm:hidden">
                <HoursChain
                  size="sm"
                  approvedHours={row.approvedHours}
                  requiredHours={row.requiredHours}
                  className="justify-end"
                />
              </span>
              <span className="font-mono text-sm tabular-nums text-copy-muted max-sm:hidden">
                {hoursText(row.approvedHours)} / {hoursText(row.requiredHours)} h
              </span>
              <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-faint" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function SupervisorEvaluationsPage() {
  const session = await requireRole(["supervisor"]);
  const queue = session.companyId ? await getEvaluationQueue(session.companyId) : null;

  const rows = queue?.ok ? queue.data.filter((row) => row.status !== "ended" || row.evaluatedAt) : [];
  const ready = rows.filter((row) => row.ready);
  const working = rows.filter((row) => !row.ready && !row.evaluatedAt && row.status === "active");
  const done = rows.filter((row) => row.evaluatedAt);

  return (
    <>
      <PageHeader
        title="Evaluations"
        description="Evaluate a student once their approved hours reach the required hours. The evaluation is final."
      />
      {!queue ? (
        <LoadError message="This account has no company. Contact the admin." />
      ) : !queue.ok ? (
        <LoadError message={queue.error.message} />
      ) : rows.length === 0 ? (
        <EmptyState>
          No students yet. A student appears here once you accept their application.
        </EmptyState>
      ) : (
        <div className="grid gap-8">
          {ready.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-8 text-center text-[15px] text-copy-muted">
              No student has reached the required hours yet.
            </p>
          ) : null}
          <Group title="Ready for evaluation" rows={ready} />
          <Group title="Working toward the hours" rows={working} />
          <Group title="Evaluated" rows={done} />
        </div>
      )}
    </>
  );
}
