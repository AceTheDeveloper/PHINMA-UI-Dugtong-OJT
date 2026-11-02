"use client";

import { useState } from "react";
import { submitEvaluationAction } from "@/app/(app)/supervisor/evaluations/actions";
import { FormMessage, useAction } from "@/components/admin/form-parts";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  maxOverallCommentLength,
  maxScoreCommentLength,
} from "@/lib/evaluations/schemas";
import type { EvaluationCriterion } from "@/lib/evaluations/supervisor-types";

// The evaluation: a score from 1 to 5 for every criterion, an optional comment
// for each, and an optional overall comment. Submitting is final and completes
// the student's deployment, so it asks for a second click. The server checks the
// hours, the company, and that every criterion of the published form is rated.

const scale = [1, 2, 3, 4, 5] as const;

function ScoreRow({
  criterion,
  index,
  score,
  comment,
  onScore,
  onComment,
}: {
  criterion: EvaluationCriterion;
  index: number;
  score: number | null;
  comment: string;
  onScore: (value: number) => void;
  onComment: (value: string) => void;
}) {
  return (
    <li className="grid gap-3 px-5 py-4 sm:px-6">
      <fieldset className="grid gap-3">
        <legend className="flex gap-3 text-[15px] font-semibold leading-[1.5] text-ink">
          <span className="w-6 shrink-0 text-right font-mono tabular-nums text-copy-muted">
            {index + 1}
          </span>
          <span className="wrap-break-word">{criterion.label}</span>
        </legend>
        <div className="flex flex-wrap gap-2 sm:pl-9">
          {scale.map((value) => (
            <label key={value} className="relative cursor-pointer">
              <input
                type="radio"
                name={`score-${criterion.id}`}
                value={value}
                checked={score === value}
                onChange={() => onScore(value)}
                className="peer sr-only"
              />
              <span
                className="grid size-11 place-items-center rounded-xl border border-border-strong bg-card font-mono text-base font-semibold tabular-nums text-ink transition-colors hover:bg-surface peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50"
              >
                {value}
              </span>
              <span className="sr-only"> out of 5</span>
            </label>
          ))}
        </div>
        <details className="sm:pl-9">
          <summary className="flex min-h-11 w-fit cursor-pointer items-center text-sm font-semibold text-primary">
            {comment ? "Edit comment" : "Add a comment"}
          </summary>
          <Textarea
            aria-label={`Comment on ${criterion.label}`}
            value={comment}
            rows={2}
            maxLength={maxScoreCommentLength}
            onChange={(event) => onComment(event.target.value)}
            className="mt-2 min-h-16"
          />
        </details>
      </fieldset>
    </li>
  );
}

export function EvaluationForm({
  deploymentId,
  studentName,
  criteria,
}: {
  deploymentId: string;
  studentName: string;
  criteria: EvaluationCriterion[];
}) {
  const { pending, message, run } = useAction();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [overall, setOverall] = useState("");
  const [confirming, setConfirming] = useState(false);
  const left = criteria.filter((criterion) => scores[criterion.id] === undefined).length;

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        run(() =>
          submitEvaluationAction({
            deploymentId,
            scores: criteria.map((criterion) => ({
              criterionId: criterion.id,
              score: scores[criterion.id],
              comment: comments[criterion.id] ?? "",
            })),
            overallComment: overall,
          }),
        );
      }}
    >
      <p className="text-sm text-copy-muted">
        Rate each criterion from 1 (lowest) to 5 (highest).
      </p>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-panel">
        {criteria.map((criterion, index) => (
          <ScoreRow
            key={criterion.id}
            criterion={criterion}
            index={index}
            score={scores[criterion.id] ?? null}
            comment={comments[criterion.id] ?? ""}
            onScore={(value) => {
              setConfirming(false);
              setScores((current) => ({ ...current, [criterion.id]: value }));
            }}
            onComment={(value) => setComments((current) => ({ ...current, [criterion.id]: value }))}
          />
        ))}
      </ul>

      <div className="grid gap-1.5">
        <label htmlFor="overall-comment" className="text-sm font-semibold text-ink">
          Overall comment (optional)
        </label>
        <Textarea
          id="overall-comment"
          value={overall}
          rows={4}
          maxLength={maxOverallCommentLength}
          onChange={(event) => setOverall(event.target.value)}
        />
      </div>

      <FormMessage message={message} />

      {confirming ? (
        <div className="grid gap-3 rounded-2xl border border-border bg-surface p-5">
          <p className="text-[15px] leading-[1.6] text-ink">
            Submit the evaluation of {studentName}? It is final: it completes their OJT with your
            company, and their certification is made from it.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending} className="h-11 px-5">
              {pending ? "Submitting" : "Submit evaluation"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="h-11 px-5"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={left > 0}
            onClick={() => setConfirming(true)}
            className="h-11 px-6"
          >
            Review and submit
          </Button>
          {left > 0 ? (
            <p className="text-sm tabular-nums text-copy-muted">
              {left} {left === 1 ? "criterion" : "criteria"} left to rate
            </p>
          ) : null}
        </div>
      )}
    </form>
  );
}
