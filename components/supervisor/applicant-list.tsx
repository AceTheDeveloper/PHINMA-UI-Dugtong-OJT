"use client";

import { useState, useTransition } from "react";
import { ExternalLink } from "lucide-react";
import { getResumeLink } from "@/app/(app)/student/resume/actions";
import {
  acceptApplicationAction,
  rejectApplicationAction,
} from "@/app/(app)/supervisor/applicants/actions";
import { FormMessage } from "@/components/admin/form-parts";
import { ApplicationStatusBadge, formatDate } from "@/components/student/application-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Applicant } from "@/lib/applicants/types";

// Applicants to the supervisor's company. Accept and reject each ask for a
// second click: accepting is final and withdraws the student's other
// applications, and a rejection cannot be undone. The server checks the
// company and the status again.
const unexpected = "Something went wrong. Try again in a moment.";

type Pending = { id: string; kind: "accept" | "reject" } | null;

export function ApplicantList({ applicants }: { applicants: Applicant[] }) {
  const [busy, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<Pending>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
        setConfirming(null);
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
    <div className="grid gap-4">
      <FormMessage message={message} />
      {notice ? (
        <p
          role="status"
          className="rounded-lg border border-success-border bg-success-tint px-3 py-2 text-sm text-success-text"
        >
          {notice}
        </p>
      ) : null}
      <ul className="grid gap-3">
        {applicants.map((applicant) => {
          const waiting = applicant.status === "applied";
          const confirmingThis = confirming?.id === applicant.id ? confirming.kind : null;
          return (
            <li key={applicant.id}>
              <Card>
                <CardContent className="grid gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="grid min-w-0 gap-1">
                      <h2 className="font-heading text-base font-bold text-ink break-words">
                        {applicant.studentName}
                      </h2>
                      <p className="text-sm text-muted-foreground break-words">
                        <span className="font-mono tabular-nums">{applicant.studentNumber}</span>
                        {" · "}
                        {applicant.listingTitle}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        Applied {formatDate(applicant.appliedAt)}
                      </p>
                    </div>
                    <ApplicationStatusBadge status={applicant.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy || !applicant.hasResume}
                      onClick={() => openResume(applicant.studentId)}
                    >
                      <ExternalLink aria-hidden="true" className="size-4" />
                      {applicant.hasResume ? "Open resume" : "No resume"}
                    </Button>
                    {waiting && confirmingThis === null ? (
                      <>
                        <Button
                          type="button"
                          disabled={busy}
                          onClick={() => setConfirming({ id: applicant.id, kind: "accept" })}
                        >
                          Accept
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={busy}
                          onClick={() => setConfirming({ id: applicant.id, kind: "reject" })}
                        >
                          Reject
                        </Button>
                      </>
                    ) : null}
                  </div>
                  {confirmingThis ? (
                    <div className="grid gap-3 rounded-xl border border-border bg-surface p-4">
                      <p className="text-sm leading-[1.6] text-ink">
                        {confirmingThis === "accept"
                          ? `Accept ${applicant.studentName}? They start as your student right away, and their other applications are withdrawn. This cannot be undone.`
                          : `Reject ${applicant.studentName}? This cannot be undone.`}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {confirmingThis === "accept" ? (
                          <Button
                            type="button"
                            disabled={busy}
                            onClick={() => decide("accept", applicant.id)}
                          >
                            Accept applicant
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="destructive"
                            disabled={busy}
                            onClick={() => decide("reject", applicant.id)}
                          >
                            Reject applicant
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          disabled={busy}
                          onClick={() => setConfirming(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
