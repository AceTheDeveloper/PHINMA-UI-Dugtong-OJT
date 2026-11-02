import { formatDate } from "@/lib/admin/format";
import type { SubmittedEvaluation } from "@/lib/evaluations/supervisor-types";

// A submitted evaluation, read only. It shows the form version it was made
// against, so a later change to the form never changes what is shown here.

function hoursText(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function EvaluationView({ evaluation }: { evaluation: SubmittedEvaluation }) {
  return (
    <section aria-label="Submitted evaluation" className="grid gap-5">
      <p className="text-[15px] leading-[1.6] text-copy-muted">
        Submitted on <span className="tabular-nums">{formatDate(evaluation.submittedAt)}</span> with{" "}
        <span className="font-mono tabular-nums">{hoursText(evaluation.approvedHours)}</span> of{" "}
        <span className="font-mono tabular-nums">{hoursText(evaluation.requiredHours)}</span> required
        hours approved. Form version {evaluation.formVersion}.
      </p>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-panel">
        {evaluation.scores.map((item, index) => (
          <li key={item.label} className="grid gap-1.5 px-5 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <p className="flex gap-3 text-[15px] font-semibold leading-[1.5] text-ink">
                <span className="w-6 shrink-0 text-right font-mono tabular-nums text-copy-muted">
                  {index + 1}
                </span>
                <span className="wrap-break-word">{item.label}</span>
              </p>
              <p
                className="shrink-0 font-mono text-lg font-semibold tabular-nums text-ink"
                aria-label={`${item.score} out of 5`}
              >
                {item.score}
                <span className="text-sm font-normal text-copy-muted"> / 5</span>
              </p>
            </div>
            {item.comment ? (
              <p className="whitespace-pre-wrap text-[15px] leading-[1.6] text-copy-muted sm:pl-9 wrap-break-word">
                {item.comment}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      {evaluation.overallComment ? (
        <div className="grid gap-1.5">
          <h3 className="text-sm font-semibold text-ink">Overall comment</h3>
          <p className="max-w-[62ch] whitespace-pre-wrap text-[15px] leading-[1.6] text-ink wrap-break-word">
            {evaluation.overallComment}
          </p>
        </div>
      ) : null}
    </section>
  );
}
