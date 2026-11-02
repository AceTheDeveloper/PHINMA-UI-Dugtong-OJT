"use client";

import { useState } from "react";
import {
  approveLogAction,
  correctLogAction,
  rejectLogAction,
  reopenLogAction,
} from "@/app/(app)/supervisor/approvals/actions";
import { FormField, FormMessage, useAction } from "@/components/admin/form-parts";
import { LogStatusBadge } from "@/components/student/log-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  clockValue,
  formatClock,
  formatDuration,
  formatLogDate,
  workedMinutes,
} from "@/lib/logs/logic";
import { maxReasonLength } from "@/lib/review/schemas";
import type { ReviewEntry } from "@/lib/review/types";

// One entry with the actions the supervisor may take on it. Reject, correct, and
// reopen each open a small form that asks for a reason; approving is one click.
// The server checks the company and the status again, and every change is
// audited with the old values kept.

type Step = "reject" | "correct" | "reopen" | null;

function Reason({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FormField id={id} label={label}>
      <Textarea
        id={id}
        value={value}
        rows={2}
        maxLength={maxReasonLength}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-16"
      />
    </FormField>
  );
}

function CorrectForm({ entry, onDone, onCancel }: { entry: ReviewEntry; onDone: () => void; onCancel: () => void }) {
  const { pending, message, run } = useAction();
  const [timeIn, setTimeIn] = useState(clockValue(entry.timeIn));
  // An entry the student never closed has no time out: start from its schedule.
  const [timeOut, setTimeOut] = useState(
    entry.timeOut ? clockValue(entry.timeOut) : (entry.scheduleEnd ?? ""),
  );
  const [breakMinutes, setBreakMinutes] = useState(String(entry.breakMinutes));
  const [reason, setReason] = useState("");
  const id = `correct-${entry.id}`;
  return (
    <form
      noValidate
      className="grid gap-4 rounded-2xl border border-border bg-surface p-5"
      onSubmit={(event) => {
        event.preventDefault();
        run(
          () =>
            correctLogAction({
              logId: entry.id,
              timeIn,
              timeOut,
              breakMinutes: breakMinutes.trim() === "" ? Number.NaN : Number(breakMinutes),
              reason,
            }),
          onDone,
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id={`${id}-in`} label="Time in">
          <Input
            id={`${id}-in`}
            type="time"
            value={timeIn}
            onChange={(event) => setTimeIn(event.target.value)}
            className="font-mono tabular-nums"
          />
        </FormField>
        <FormField id={`${id}-out`} label="Time out">
          <Input
            id={`${id}-out`}
            type="time"
            value={timeOut}
            onChange={(event) => setTimeOut(event.target.value)}
            className="font-mono tabular-nums"
          />
        </FormField>
        <FormField id={`${id}-break`} label="Break in minutes">
          <Input
            id={`${id}-break`}
            type="number"
            inputMode="numeric"
            min={0}
            value={breakMinutes}
            onChange={(event) => setBreakMinutes(event.target.value)}
            className="font-mono tabular-nums"
          />
        </FormField>
      </div>
      <Reason id={`${id}-reason`} label="Reason for the correction" value={reason} onChange={setReason} />
      <FormMessage message={message} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} className="h-11 px-5">
          {pending ? "Saving correction" : "Save correction"}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel} className="h-11 px-5">
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ReasonForm({
  entry,
  kind,
  onDone,
  onCancel,
}: {
  entry: ReviewEntry;
  kind: "reject" | "reopen";
  onDone: () => void;
  onCancel: () => void;
}) {
  const { pending, message, run } = useAction();
  const [reason, setReason] = useState("");
  const reject = kind === "reject";
  return (
    <form
      noValidate
      className="grid gap-4 rounded-2xl border border-border bg-surface p-5"
      onSubmit={(event) => {
        event.preventDefault();
        run(
          () =>
            reject
              ? rejectLogAction({ logId: entry.id, reason })
              : reopenLogAction({ logId: entry.id, reason }),
          onDone,
        );
      }}
    >
      <Reason
        id={`${kind}-${entry.id}`}
        label={reject ? "Why are you rejecting this entry?" : "Why are you reopening this entry?"}
        value={reason}
        onChange={setReason}
      />
      <FormMessage message={message} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant={reject ? "destructive" : "default"}
          disabled={pending}
          className="h-11 px-5"
        >
          {reject ? "Reject entry" : "Reopen entry"}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel} className="h-11 px-5">
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ReviewEntryCard({
  entry,
  showStudent,
}: {
  entry: ReviewEntry;
  showStudent: boolean;
}) {
  const [step, setStep] = useState<Step>(null);
  const approving = useAction();
  const closed = () => setStep(null);
  const worked = workedMinutes(entry);
  const needsTimeOut = entry.status === "open" && entry.timeOut === null;

  return (
    <li className="grid gap-3 px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="grid min-w-0 gap-0.5">
          {showStudent ? (
            <p className="font-heading text-[17px] font-bold leading-tight text-ink wrap-break-word">
              {entry.studentName}{" "}
              <span className="font-mono text-sm font-normal tabular-nums text-copy-muted">
                {entry.studentNumber}
              </span>
            </p>
          ) : (
            <p className="font-heading text-[17px] font-bold leading-tight text-ink">
              {formatLogDate(entry.logDate)}
            </p>
          )}
          <p className="text-[15px] tabular-nums text-copy-muted">
            {showStudent ? `${formatLogDate(entry.logDate)} · ` : null}
            <span className="font-mono">
              {formatClock(entry.timeIn)}
              {entry.timeOut ? ` to ${formatClock(entry.timeOut)}` : ""}
            </span>
            {entry.timeOut ? ` · ${formatDuration(worked)} worked` : null}
            {entry.breakMinutes > 0 ? ` · ${entry.breakMinutes} min break` : null}
          </p>
        </div>
        <LogStatusBadge status={entry.status} />
      </div>

      {needsTimeOut ? (
        <p className="text-sm text-warning-text">
          The student never timed out. Set the time out so the day can be reviewed.
        </p>
      ) : null}
      {entry.earlyOutReason ? (
        <p className="text-sm text-muted-foreground">Timed out early: {entry.earlyOutReason}</p>
      ) : null}
      {entry.addedBySupervisor && entry.correctionReason ? (
        <p className="text-sm text-muted-foreground">Added by you: {entry.correctionReason}</p>
      ) : entry.correctionReason ? (
        <p className="text-sm text-muted-foreground">Corrected: {entry.correctionReason}</p>
      ) : null}
      {entry.reopenReason && entry.status === "pending" ? (
        <p className="text-sm text-muted-foreground">Reopened: {entry.reopenReason}</p>
      ) : null}
      {entry.journal ? (
        <p className="max-w-[62ch] whitespace-pre-wrap text-[15px] leading-[1.6] text-ink wrap-break-word">
          {entry.journal}
        </p>
      ) : entry.status !== "open" ? (
        <p className="text-sm text-muted-foreground">No journal yet.</p>
      ) : null}
      {entry.status === "rejected" ? (
        <p className="rounded-lg border border-error-border bg-error-tint px-3 py-2 text-sm text-error-text">
          {entry.rejectReason ?? "Sent back to the student."}
        </p>
      ) : null}

      <FormMessage message={approving.message} />

      {step === "correct" ? (
        <CorrectForm entry={entry} onDone={closed} onCancel={closed} />
      ) : step === "reject" || step === "reopen" ? (
        <ReasonForm entry={entry} kind={step} onDone={closed} onCancel={closed} />
      ) : (
        <div className="flex flex-wrap gap-2">
          {entry.status === "pending" ? (
            <>
              <Button
                type="button"
                disabled={approving.pending}
                onClick={() => approving.run(() => approveLogAction({ logId: entry.id }))}
                className="h-11 px-5"
              >
                {approving.pending ? "Approving" : "Approve"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setStep("reject")} className="h-11 px-5">
                Reject
              </Button>
            </>
          ) : null}
          {entry.status !== "approved" ? (
            <Button
              type="button"
              variant={needsTimeOut ? "default" : "outline"}
              onClick={() => setStep("correct")}
              className="h-11 px-5"
            >
              {needsTimeOut ? "Set time out" : "Correct times"}
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => setStep("reopen")} className="h-11 px-5">
              Reopen
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
