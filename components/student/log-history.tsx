"use client";

import { useState } from "react";
import { resubmitLogAction } from "@/app/(app)/student/logs/actions";
import { FormMessage, useAction } from "@/components/admin/form-parts";
import { LogStatusBadge } from "@/components/student/log-status";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatClock, formatDuration, formatLogDate, workedMinutes } from "@/lib/logs/logic";
import { maxJournalLength } from "@/lib/logs/schemas";
import type { LogEntry } from "@/lib/logs/types";
import { groupByWeek } from "@/lib/logs/week";

// The student's entries, newest first, in weeks with each week's approved hours. A rejected entry shows the supervisor's
// reason and lets the student fix the journal and resubmit it. Times are the
// server's; the student never edits them.

function Resubmit({ entry }: { entry: LogEntry }) {
  const { pending, message, run } = useAction();
  const [journal, setJournal] = useState(entry.journal ?? "");
  return (
    <form
      noValidate
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => resubmitLogAction({ logId: entry.id, journal }));
      }}
    >
      <div className="grid gap-1.5">
        <label htmlFor={`journal-${entry.id}`} className="text-sm font-semibold text-ink">
          Fix your journal
        </label>
        <Textarea
          id={`journal-${entry.id}`}
          value={journal}
          maxLength={maxJournalLength}
          rows={4}
          onChange={(event) => setJournal(event.target.value)}
        />
      </div>
      <FormMessage message={message} />
      <Button type="submit" disabled={pending} className="h-11 w-fit px-6">
        {pending ? "Resubmitting" : "Resubmit entry"}
      </Button>
    </form>
  );
}

function Row({ entry }: { entry: LogEntry }) {
  const worked = workedMinutes(entry);
  return (
    <li className="grid gap-3 px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="grid gap-0.5">
          <p className="font-heading text-[17px] font-bold leading-tight text-ink">
            {formatLogDate(entry.logDate)}
          </p>
          <p className="text-[15px] tabular-nums text-copy-muted">
            <span>
              {formatClock(entry.timeIn)}
              {entry.timeOut ? ` to ${formatClock(entry.timeOut)}` : ""}
            </span>
            {entry.timeOut ? ` · ${formatDuration(worked)}` : null}
            {" · "}
            {entry.companyName}
          </p>
        </div>
        <LogStatusBadge status={entry.status} />
      </div>

      {entry.status === "open" && entry.timeOut === null ? (
        <p className="text-sm text-muted-foreground">
          No time out was recorded. Ask your supervisor to set it.
        </p>
      ) : null}
      {entry.earlyOutReason ? (
        <p className="text-sm text-muted-foreground">Timed out early: {entry.earlyOutReason}</p>
      ) : null}

      {entry.status === "rejected" ? (
        <>
          {entry.rejectReason ? (
            <p className="rounded-lg border border-error-border bg-error-tint px-3 py-2 text-sm text-error-text">
              {entry.rejectReason}
            </p>
          ) : null}
          <Resubmit entry={entry} />
        </>
      ) : entry.journal ? (
        <p className="max-w-[62ch] whitespace-pre-wrap text-[15px] leading-[1.6] text-ink wrap-break-word">
          {entry.journal}
        </p>
      ) : null}
    </li>
  );
}

export function LogHistory({ entries }: { entries: LogEntry[] }) {
  // Entries that need the student first, then the rest in date order.
  const fix = entries.filter((entry) => entry.status === "rejected");
  const rest = entries.filter((entry) => entry.status !== "rejected");
  return (
    <div className="grid gap-6">
      {fix.length > 0 ? (
        <section aria-label="Needs your fix" className="grid gap-2">
          <h2 className="px-1 text-[15px] font-semibold text-copy-muted">
            Needs your fix <span className="tabular-nums">({fix.length})</span>
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-panel">
            {fix.map((entry) => (
              <Row key={entry.id} entry={entry} />
            ))}
          </ul>
        </section>
      ) : null}
      {groupByWeek(rest).map((week) => (
        <section key={week.weekStart} aria-label={week.label} className="grid gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 px-1">
            <h2 className="font-heading text-lg font-bold text-ink">{week.label}</h2>
            <p className="text-[15px] tabular-nums text-copy-muted">
              <span className="font-semibold text-ink">{formatDuration(week.approvedMinutes)}</span>{" "}
              approved
              {week.pendingCount > 0 ? `, ${week.pendingCount} waiting` : ""}
            </p>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-panel">
            {week.entries.map((entry) => (
              <Row key={entry.id} entry={entry} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
