"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { resendInvitation, sendInvitations } from "@/app/(app)/coordinator/roster/actions";
import { FormMessage } from "@/components/admin/form-parts";
import { Button } from "@/components/ui/button";
import type { SendReport } from "@/lib/roster/types";

// Sends every outstanding invitation in the batch. Safe to press again: the
// server skips students who already have a pending invitation or an account.
export function SendInvitationsButton({
  batchId,
  waiting,
}: {
  batchId: string;
  waiting: number;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [report, setReport] = useState<SendReport | null>(null);

  function send() {
    setMessage(null);
    setReport(null);
    startTransition(async () => {
      try {
        const result = await sendInvitations({ batchId });
        if (result.ok) {
          setReport(result.data);
        } else {
          setMessage(result.error.message);
        }
      } catch {
        setMessage("Something went wrong. Try again in a moment.");
      }
    });
  }

  return (
    <div className="grid justify-items-start gap-3">
      <Button type="button" disabled={pending || waiting === 0} onClick={send}>
        <Send aria-hidden="true" data-icon="inline-start" />
        {pending ? "Sending invitations" : `Send invitations (${waiting})`}
      </Button>
      <FormMessage message={message} />
      {report ? (
        <div role="status" className="grid gap-2 text-sm">
          <p className="text-ink tabular-nums">
            Sent {report.sent} {report.sent === 1 ? "invitation" : "invitations"}
            {report.failed.length > 0 ? `. ${report.failed.length} could not be sent:` : "."}
          </p>
          {report.failed.length > 0 ? (
            <ul className="grid gap-1 rounded-lg border border-error-border bg-error-tint px-3 py-2 text-error-text">
              {report.failed.map((failure) => (
                <li key={failure.studentId}>
                  {failure.name}: {failure.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ResendButton({
  studentId,
  label,
}: {
  studentId: string;
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function send() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await resendInvitation({ studentId });
        if (!result.ok) setMessage(result.error.message);
      } catch {
        setMessage("Something went wrong. Try again in a moment.");
      }
    });
  }

  return (
    <div className="grid justify-items-end gap-1">
      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={send}>
        {pending ? "Sending invitation" : label}
      </Button>
      {message ? <p className="max-w-56 text-xs text-error-text">{message}</p> : null}
    </div>
  );
}
