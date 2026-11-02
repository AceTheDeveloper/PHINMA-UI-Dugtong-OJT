"use client";

import { useState, useTransition } from "react";
import { withdrawApplicationAction } from "@/app/(app)/student/applications/actions";
import { FormMessage } from "@/components/admin/form-parts";
import { ApplicationStatusBadge, formatDate } from "@/components/student/application-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { StudentApplication } from "@/lib/applications/types";

// The student's applications. Withdrawing asks for a second click first, because
// a withdrawn application cannot be reopened. The server decides who may
// withdraw what.
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
      <ul className="grid gap-3">
        {applications.map((application) => (
          <li key={application.id}>
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0 grid gap-1">
                  <h2 className="font-heading text-base font-bold text-ink break-words">
                    {application.listingTitle}
                  </h2>
                  <p className="text-sm text-muted-foreground break-words">
                    {application.companyName}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Applied {formatDate(application.appliedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <ApplicationStatusBadge status={application.status} />
                  {application.status === "applied" ? (
                    confirming === application.id ? (
                      <span className="flex flex-wrap items-center gap-2">
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
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={pending}
                        onClick={() => setConfirming(application.id)}
                      >
                        Withdraw
                      </Button>
                    )
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
