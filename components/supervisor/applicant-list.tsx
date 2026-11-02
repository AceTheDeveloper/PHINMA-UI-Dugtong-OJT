"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getResumeLink } from "@/app/(app)/student/resume/actions";
import {
  acceptApplicationAction,
  rejectApplicationAction,
} from "@/app/(app)/supervisor/applicants/actions";
import { FormMessage } from "@/components/admin/form-parts";
import { focusStyle } from "@/components/brand-link";
import { ApplicationStatusBadge, formatDate } from "@/components/student/application-status";
import { Button } from "@/components/ui/button";
import type { Applicant } from "@/lib/applicants/types";
import { cn } from "@/lib/utils";

// Applicants to the supervisor's company: the list on the left, the chosen
// applicant on the right (on phones, one at a time with a way back). Accept and
// reject each ask for a second click: accepting is final and withdraws the
// student's other applications, and a rejection cannot be undone. The server
// checks the company and the status again.
const unexpected = "Something went wrong. Try again in a moment.";

type Step = "accept" | "reject" | null;

function Group({
  title,
  applicants,
  selectedId,
  onSelect,
}: {
  title: string;
  applicants: Applicant[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (applicants.length === 0) return null;
  return (
    <section aria-label={title} className="grid gap-2">
      <h2 className="px-1 text-[15px] font-semibold text-copy-muted">
        {title} <span className="tabular-nums">({applicants.length})</span>
      </h2>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-panel">
        {applicants.map((applicant) => {
          const selected = applicant.id === selectedId;
          return (
            <li key={applicant.id}>
              <button
                type="button"
                onClick={() => onSelect(applicant.id)}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface",
                  selected && "bg-primary-tint hover:bg-primary-tint",
                  focusStyle,
                )}
              >
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="font-heading text-base font-bold leading-snug text-ink wrap-break-word">
                    {applicant.studentName}
                  </span>
                  <span className="text-sm text-copy-muted wrap-break-word">
                    {applicant.listingTitle}
                  </span>
                </span>
                {applicant.status !== "applied" ? (
                  <ApplicationStatusBadge status={applicant.status} />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ApplicantList({ applicants }: { applicants: Applicant[] }) {
  const [busy, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selected = applicants.find((applicant) => applicant.id === selectedId) ?? null;
  const waiting = applicants.filter((applicant) => applicant.status === "applied");
  const decided = applicants.filter((applicant) => applicant.status !== "applied");

  function select(id: string) {
    setSelectedId(id);
    setStep(null);
    setMessage(null);
    setNotice(null);
  }

  function decide(kind: "accept" | "reject", applicationId: string) {
    setMessage(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const result =
          kind === "accept"
            ? await acceptApplicationAction({ applicationId })
            : await rejectApplicationAction({ applicationId });
        if (result.ok) {
          setNotice(kind === "accept" ? "Applicant accepted." : "Applicant rejected.");
        } else {
          setMessage(result.error.message);
        }
      } catch {
        setMessage(unexpected);
      } finally {
        setStep(null);
      }
    });
  }

  function openResume(studentId: string) {
    setMessage(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await getResumeLink({ studentId });
        if (!result.ok) {
          setMessage(result.error.message);
          return;
        }
        window.open(result.data, "_blank", "noopener,noreferrer");
      } catch {
        setMessage(unexpected);
      }
    });
  }

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)] md:items-start">
      <div className={cn("grid gap-6", selected && "max-md:hidden")}>
        <Group title="Waiting for a decision" applicants={waiting} selectedId={selectedId} onSelect={select} />
        <Group title="Decided" applicants={decided} selectedId={selectedId} onSelect={select} />
      </div>

      <div className={cn(!selected && "max-md:hidden")}>
        {selected ? (
          <section
            aria-label="Applicant"
            className="grid gap-6 rounded-3xl border border-border bg-card p-6 shadow-panel sm:p-8"
          >
            <Button
              type="button"
              variant="ghost"
              className="-ml-2 w-fit md:hidden"
              onClick={() => setSelectedId(null)}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back to applicants
            </Button>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid min-w-0 gap-1">
                <h2 className="font-heading text-2xl font-extrabold leading-tight tracking-[-0.02em] text-ink wrap-break-word">
                  {selected.studentName}
                </h2>
                <p className="text-[15px] text-copy-muted wrap-break-word">
                  <span className="font-mono tabular-nums">{selected.studentNumber}</span>
                </p>
              </div>
              <ApplicationStatusBadge status={selected.status} />
            </div>
            <dl className="grid gap-4 text-[15px] sm:grid-cols-2">
              <div className="grid gap-0.5">
                <dt className="text-sm text-muted-foreground">Applied for</dt>
                <dd className="font-semibold text-ink wrap-break-word">{selected.listingTitle}</dd>
              </div>
              <div className="grid gap-0.5">
                <dt className="text-sm text-muted-foreground">Applied on</dt>
                <dd className="font-semibold tabular-nums text-ink">{formatDate(selected.appliedAt)}</dd>
              </div>
            </dl>

            <FormMessage message={message} />
            {notice ? (
              <p
                role="status"
                className="rounded-lg border border-success-border bg-success-tint px-3 py-2 text-sm text-success-text"
              >
                {notice}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy || !selected.hasResume}
                onClick={() => openResume(selected.studentId)}
              >
                <ExternalLink aria-hidden="true" className="size-4" />
                {selected.hasResume ? "Open resume" : "No resume"}
              </Button>
              {selected.status === "applied" && step === null ? (
                <>
                  <Button type="button" disabled={busy} onClick={() => setStep("accept")}>
                    Accept
                  </Button>
                  <Button type="button" variant="outline" disabled={busy} onClick={() => setStep("reject")}>
                    Reject
                  </Button>
                </>
              ) : null}
            </div>

            {selected.status === "applied" && step ? (
              <div className="grid gap-3 rounded-2xl border border-border bg-surface p-5">
                <p className="text-[15px] leading-[1.6] text-ink">
                  {step === "accept"
                    ? `Accept ${selected.studentName}? They start as your student right away, and their other applications are withdrawn. This cannot be undone.`
                    : `Reject ${selected.studentName}? This cannot be undone.`}
                </p>
                <div className="flex flex-wrap gap-2">
                  {step === "accept" ? (
                    <Button type="button" disabled={busy} onClick={() => decide("accept", selected.id)}>
                      Accept applicant
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => decide("reject", selected.id)}
                    >
                      Reject applicant
                    </Button>
                  )}
                  <Button type="button" variant="outline" disabled={busy} onClick={() => setStep(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </section>
        ) : (
          <p className="rounded-3xl border border-dashed border-border-strong bg-surface px-6 py-16 text-center text-[15px] text-copy-muted">
            Choose an applicant to read their details and decide.
          </p>
        )}
      </div>
    </div>
  );
}
