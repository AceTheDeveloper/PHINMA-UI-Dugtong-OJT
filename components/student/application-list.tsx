"use client";

import { useState, useTransition } from "react";
import { withdrawApplicationAction } from "@/app/(app)/student/applications/actions";
import { FormMessage } from "@/components/admin/form-parts";
import { ApplicationStatusBadge, formatDate } from "@/components/student/application-status";
import { Button } from "@/components/ui/button";
import type { StudentApplication } from "@/lib/applications/types";

// The student's applications, one row each in a single panel. Withdrawing asks
// for a second click first, because a withdrawn application cannot be
// reopened. The server decides who may withdraw what.
const unexpected = "Something went wrong. Try again in a moment.";

export function ApplicationList({ applications }: { applications: StudentApplication[] }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function withdraw(applicationId: string) {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await withdrawApplicationAction({ applicationId });
        if (!result.ok) setMessage(result.error.message);
      } catch {
        setMessage(unexpected);
      } finally {
        setConfirming(null);
      }
    });
  }

  return (
    <div className="grid gap-4">
      <FormMessage message={message} />
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-panel">
        {applications.map((application) => (
          <li key={application.id} className="grid gap-4 px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid min-w-0 gap-1">
                <h2 className="font-heading text-lg font-bold leading-snug text-ink wrap-break-word">
                  {application.listingTitle}
                </h2>
                <p className="text-[15px] text-copy-muted wrap-break-word">{application.companyName}</p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  Applied {formatDate(application.appliedAt)}
                </p>
              </div>
              <ApplicationStatusBadge status={application.status} />
            </div>
            {application.status === "applied" ? (
              confirming === application.id ? (
                <div className="grid gap-3 rounded-xl border border-border bg-surface p-4">
                  <p className="text-[15px] leading-[1.6] text-ink">
                    Withdraw this application? You cannot reopen it afterwards.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={pending}
                      onClick={() => withdraw(application.id)}
                    >
                      Withdraw application
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => setConfirming(null)}
                    >
                      Keep application
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() => setConfirming(application.id)}
                  >
                    Withdraw
                  </Button>
                </div>
              )
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
