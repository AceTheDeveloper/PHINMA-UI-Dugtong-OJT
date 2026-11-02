"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import {
  createDraftAction,
  discardDraftAction,
  publishFormAction,
  saveDraftAction,
} from "@/app/(app)/coordinator/evaluations/actions";
import { FormMessage, useAction } from "@/components/admin/form-parts";
import { RoleBadge } from "@/components/coordinator/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/admin/format";
import { maxCriteria, maxCriterionLength } from "@/lib/evaluations/schemas";
import type { CourseForms, EvaluationForm } from "@/lib/evaluations/types";

// The evaluation form of one course. A published form is read only; a change is
// a new version, edited as a draft and then published. Publishing saves what is
// on screen first, so supervisors get exactly what the coordinator sees. The
// database checks the course and the status again, and locks a published form.

type Item = { key: number; label: string };

function Criteria({ form }: { form: EvaluationForm }) {
  return (
    <ol className="grid gap-1.5">
      {form.criteria.map((label, index) => (
        <li key={`${index}-${label}`} className="flex gap-3 text-[15px] leading-[1.5] text-ink">
          <span className="w-6 shrink-0 text-right font-mono tabular-nums text-copy-muted">
            {index + 1}
          </span>
          <span className="wrap-break-word">{label}</span>
        </li>
      ))}
    </ol>
  );
}

function Published({ form }: { form: EvaluationForm }) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-heading text-base font-bold text-ink">Version {form.version}</h3>
        <RoleBadge role="success">Published</RoleBadge>
        {form.publishedAt ? (
          <span className="text-sm tabular-nums text-copy-muted">{formatDate(form.publishedAt)}</span>
        ) : null}
      </div>
      <Criteria form={form} />
      <p className="text-sm text-muted-foreground">
        Supervisors rate each criterion from 1 to 5 and can add a comment for each one and an overall
        comment.
      </p>
    </div>
  );
}

function Draft({ form }: { form: EvaluationForm }) {
  const next = useRef(form.criteria.length);
  const [items, setItems] = useState<Item[]>(() =>
    form.criteria.map((label, index) => ({ key: index, label })),
  );
  const [step, setStep] = useState<"publish" | "discard" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const save = useAction();
  const publish = useAction();
  const discard = useAction();
  const busy = save.pending || publish.pending || discard.pending;
  const labels = items.map((item) => item.label);

  function change(update: (current: Item[]) => Item[]) {
    setNotice(null);
    setStep(null);
    setItems(update);
  }

  function move(index: number, by: -1 | 1) {
    change((current) => {
      const target = index + by;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-heading text-base font-bold text-ink">Version {form.version}</h3>
        <RoleBadge role="warning">Draft</RoleBadge>
      </div>

      <ul className="grid gap-2">
        {items.map((item, index) => (
          <li key={item.key} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-right font-mono text-[15px] tabular-nums text-copy-muted">
              {index + 1}
            </span>
            <Input
              value={item.label}
              maxLength={maxCriterionLength}
              aria-label={`Criterion ${index + 1}`}
              onChange={(event) =>
                change((current) =>
                  current.map((entry) =>
                    entry.key === item.key ? { ...entry, label: event.target.value } : entry,
                  ),
                )
              }
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Move criterion ${index + 1} up`}
              disabled={index === 0}
              onClick={() => move(index, -1)}
              className="size-9 pointer-coarse:size-11"
            >
              <ArrowUp aria-hidden="true" className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Move criterion ${index + 1} down`}
              disabled={index === items.length - 1}
              onClick={() => move(index, 1)}
              className="size-9 pointer-coarse:size-11"
            >
              <ArrowDown aria-hidden="true" className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove criterion ${index + 1}`}
              onClick={() => change((current) => current.filter((entry) => entry.key !== item.key))}
              className="size-9 pointer-coarse:size-11"
            >
              <X aria-hidden="true" className="size-4" />
            </Button>
          </li>
        ))}
      </ul>

      {items.length === 0 ? (
        <p className="text-[15px] text-copy-muted">No criteria yet. Add the first one.</p>
      ) : null}

      <div>
        <Button
          type="button"
          variant="outline"
          disabled={items.length >= maxCriteria}
          onClick={() =>
            change((current) => {
              next.current += 1;
              return [...current, { key: next.current, label: "" }];
            })
          }
          className="h-11 px-4"
        >
          <Plus aria-hidden="true" className="size-4" />
          Add criterion
        </Button>
        {items.length >= maxCriteria ? (
          <p className="mt-1.5 text-xs text-muted-foreground">A form can have up to {maxCriteria} criteria.</p>
        ) : null}
      </div>

      <FormMessage message={save.message ?? publish.message ?? discard.message} />
      {notice ? (
        <p
          role="status"
          className="rounded-lg border border-success-border bg-success-tint px-3 py-2 text-sm text-success-text"
        >
          {notice}
        </p>
      ) : null}

      {step === "publish" ? (
        <div className="grid gap-3 rounded-2xl border border-border bg-surface p-5">
          <p className="text-[15px] leading-[1.6] text-ink">
            Publish version {form.version}? Supervisors use it from now on. A published form cannot be
            edited; to change it later you start a new version.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy}
              className="h-11 px-5"
              onClick={() =>
                publish.run(
                  () => publishFormAction({ formId: form.id, criteria: labels }),
                  () => setStep(null),
                )
              }
            >
              {publish.pending ? "Publishing" : "Publish form"}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setStep(null)} className="h-11 px-5">
              Cancel
            </Button>
          </div>
        </div>
      ) : step === "discard" ? (
        <div className="grid gap-3 rounded-2xl border border-border bg-surface p-5">
          <p className="text-[15px] leading-[1.6] text-ink">
            Discard this draft? The criteria you changed are lost. The published form is not affected.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              className="h-11 px-5"
              onClick={() => discard.run(() => discardDraftAction({ formId: form.id }))}
            >
              {discard.pending ? "Discarding" : "Discard draft"}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setStep(null)} className="h-11 px-5">
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            className="h-11 px-5"
            onClick={() =>
              save.run(
                () => saveDraftAction({ formId: form.id, criteria: labels }),
                () => setNotice("Draft saved."),
              )
            }
          >
            {save.pending ? "Saving draft" : "Save draft"}
          </Button>
          <Button type="button" disabled={busy || items.length === 0} onClick={() => setStep("publish")} className="h-11 px-5">
            Publish form
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => setStep("discard")} className="h-11 px-5">
            Discard draft
          </Button>
        </div>
      )}
    </div>
  );
}

export function EvaluationFormEditor({ course }: { course: CourseForms }) {
  const create = useAction();
  const { published, draft } = course;
  return (
    <section
      aria-label={course.courseLabel}
      className="grid gap-6 rounded-3xl border border-border bg-card p-6 shadow-panel sm:p-8"
    >
      <h2 className="font-heading text-xl font-bold leading-tight text-ink">{course.courseLabel}</h2>

      {draft ? <Draft key={draft.id} form={draft} /> : null}

      {published ? (
        <div className={draft ? "grid gap-3 border-t border-border pt-6" : "grid gap-3"}>
          {draft ? <p className="text-sm text-muted-foreground">Supervisors still use this version until you publish the draft.</p> : null}
          <Published form={published} />
        </div>
      ) : null}

      {!draft ? (
        <div className="grid gap-3">
          {!published ? (
            <p className="max-w-[56ch] text-[15px] leading-[1.6] text-copy-muted">
              No evaluation form yet. Supervisors cannot evaluate students until you publish one.
            </p>
          ) : null}
          <FormMessage message={create.message} />
          <div>
            <Button
              type="button"
              disabled={create.pending}
              variant={published ? "outline" : "default"}
              className="h-11 px-5"
              onClick={() => create.run(() => createDraftAction({ courseId: course.courseId }))}
            >
              {create.pending ? "Starting" : published ? "Start a new version" : "Create the form"}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
