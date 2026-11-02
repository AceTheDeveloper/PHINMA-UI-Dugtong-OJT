"use client";

import { useState } from "react";
import { LogStatusBadge } from "@/components/student/log-status";
import { Button } from "@/components/ui/button";
import type { StudentEntry } from "@/lib/coordinator/student-types";
import { formatClock, formatDuration, formatLogDate, workedMinutes } from "@/lib/logs/logic";

// A student's daily entries as the coordinator reads them: every status, with the
// journal and every reason, newest first. Read only; only approved entries count
// toward hours, and the badge says which these are. Fifty at a time.

const pageSize = 50;

function Entry({ entry }: { entry: StudentEntry }) {
  const worked = workedMinutes({
    timeIn: entry.timeIn,
    timeOut: entry.timeOut,
    breakMinutes: entry.breakMinutes,
  });
  return (
    <li className="grid gap-2 px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="grid gap-0.5">
          <p className="font-heading text-[17px] font-bold leading-tight text-ink">
            {formatLogDate(entry.logDate)}
          </p>
          <p className="text-[15px] tabular-nums text-copy-muted">
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
      {entry.status === "open" && entry.timeOut === null ? (
        <p className="text-sm text-warning-text">No time out was recorded.</p>
      ) : null}
      {entry.earlyOutReason ? (
        <p className="text-sm text-muted-foreground">Timed out early: {entry.earlyOutReason}</p>
      ) : null}
      {entry.correctionReason ? (
        <p className="text-sm text-muted-foreground">
          {entry.addedBySupervisor ? "Added by the supervisor" : "Corrected by the supervisor"}:{" "}
          {entry.correctionReason}
        </p>
      ) : null}
      {entry.reopenReason ? (
        <p className="text-sm text-muted-foreground">Reopened: {entry.reopenReason}</p>
      ) : null}
      {entry.journal ? (
        <p className="max-w-[62ch] whitespace-pre-wrap text-[15px] leading-[1.6] text-ink wrap-break-word">
          {entry.journal}
        </p>
      ) : entry.status !== "open" ? (
        <p className="text-sm text-muted-foreground">No journal.</p>
      ) : null}
      {entry.status === "rejected" && entry.rejectReason ? (
        <p className="rounded-lg border border-error-border bg-error-tint px-3 py-2 text-sm text-error-text">
          {entry.rejectReason}
        </p>
      ) : null}
    </li>
  );
}

export function StudentEntryList({ entries }: { entries: StudentEntry[] }) {
  const [shown, setShown] = useState(pageSize);
  if (entries.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-8 text-center text-[15px] text-copy-muted">
        No entries yet.
      </p>
    );
  }
  return (
    <div className="grid gap-3">
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-panel">
        {entries.slice(0, shown).map((entry) => (
          <Entry key={entry.id} entry={entry} />
        ))}
      </ul>
      {entries.length > shown ? (
        <div>
          <Button
            type="button"
            variant="outline"
            className="h-11 px-5"
            onClick={() => setShown((current) => current + pageSize)}
          >
            Show {Math.min(pageSize, entries.length - shown)} more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
