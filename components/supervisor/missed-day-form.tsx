"use client";

import { useState } from "react";
import { addMissedDayAction } from "@/app/(app)/supervisor/approvals/actions";
import { FormField, FormMessage, SubmitRow, useAction } from "@/components/admin/form-parts";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { maxReasonLength } from "@/lib/review/schemas";

// Records a day the student worked but never timed in. The day goes back to the
// student, who writes the journal; then it comes to the supervisor to approve.
// The server checks the student is at this company, the date is not in the
// future or before the deployment, and the day has no entry yet.

export function MissedDayForm({
  deploymentId,
  today,
  defaultStart,
  defaultEnd,
}: {
  deploymentId: string;
  today: string;
  defaultStart: string;
  defaultEnd: string;
}) {
  const { pending, message, run } = useAction();
  const [logDate, setLogDate] = useState("");
  const [timeIn, setTimeIn] = useState(defaultStart);
  const [timeOut, setTimeOut] = useState(defaultEnd);
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setNotice(null);
        run(
          () =>
            addMissedDayAction({
              deploymentId,
              logDate,
              timeIn,
              timeOut,
              breakMinutes: breakMinutes.trim() === "" ? Number.NaN : Number(breakMinutes),
              reason,
            }),
          () => {
            setNotice("Day added. The student can now write the journal.");
            setLogDate("");
            setReason("");
          },
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-4">
        <FormField id="missed-date" label="Day">
          <Input
            id="missed-date"
            type="date"
            max={today}
            value={logDate}
            onChange={(event) => setLogDate(event.target.value)}
          />
        </FormField>
        <FormField id="missed-in" label="Time in">
          <Input
            id="missed-in"
            type="time"
            value={timeIn}
            onChange={(event) => setTimeIn(event.target.value)}
            className="font-mono tabular-nums"
          />
        </FormField>
        <FormField id="missed-out" label="Time out">
          <Input
            id="missed-out"
            type="time"
            value={timeOut}
            onChange={(event) => setTimeOut(event.target.value)}
            className="font-mono tabular-nums"
          />
        </FormField>
        <FormField id="missed-break" label="Break in minutes">
          <Input
            id="missed-break"
            type="number"
            inputMode="numeric"
            min={0}
            value={breakMinutes}
            onChange={(event) => setBreakMinutes(event.target.value)}
            className="font-mono tabular-nums"
          />
        </FormField>
      </div>
      <FormField id="missed-reason" label="Why is the day being added?">
        <Textarea
          id="missed-reason"
          value={reason}
          rows={2}
          maxLength={maxReasonLength}
          onChange={(event) => setReason(event.target.value)}
          className="min-h-16"
        />
      </FormField>
      <FormMessage message={message} />
      {notice ? (
        <p
          role="status"
          className="rounded-lg border border-success-border bg-success-tint px-3 py-2 text-sm text-success-text"
        >
          {notice}
        </p>
      ) : null}
      <SubmitRow label="Add day" pendingLabel="Adding day" pending={pending} />
    </form>
  );
}
