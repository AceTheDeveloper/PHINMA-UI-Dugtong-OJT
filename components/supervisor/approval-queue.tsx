"use client";

import { useState } from "react";
import { bulkApproveAction } from "@/app/(app)/supervisor/approvals/actions";
import { FormMessage, useAction } from "@/components/admin/form-parts";
import { ReviewEntryCard } from "@/components/supervisor/review-entry";
import { Button } from "@/components/ui/button";
import { formatLogDate } from "@/lib/logs/logic";
import type { ReviewEntry } from "@/lib/review/types";

// Pending entries grouped by day, newest first. "Approve all" for a day approves
// exactly the entries shown for it, in one transaction: if any of them can no
// longer be approved, none is.

function groupByDay(entries: readonly ReviewEntry[]): [string, ReviewEntry[]][] {
  const days = new Map<string, ReviewEntry[]>();
  for (const entry of entries) {
    const list = days.get(entry.logDate);
    if (list) list.push(entry);
    else days.set(entry.logDate, [entry]);
  }
  return [...days.entries()].sort(([a], [b]) => b.localeCompare(a));
}

function Day({ date, entries }: { date: string; entries: ReviewEntry[] }) {
  const { pending, message, run } = useAction();
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <section aria-label={formatLogDate(date)} className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <h2 className="font-heading text-lg font-bold text-ink">
          {formatLogDate(date)}{" "}
          <span className="text-[15px] font-semibold tabular-nums text-copy-muted">({entries.length})</span>
        </h2>
        {entries.length > 1 ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            className="h-11 px-5"
            onClick={() => {
              setNotice(null);
              run(
                async () => {
                  const result = await bulkApproveAction({ logIds: entries.map((entry) => entry.id) });
                  if (!result.ok) return result;
                  setNotice(`${result.data} entries approved.`);
                  return { ok: true as const, data: null };
                },
              );
            }}
          >
            {pending ? "Approving" : `Approve all ${entries.length}`}
          </Button>
        ) : null}
      </div>
      <FormMessage message={message} />
      {notice ? (
        <p
          role="status"
          className="rounded-lg border border-success-border bg-success-tint px-3 py-2 text-sm text-success-text"
        >
          {notice}
        </p>
      ) : null}
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-panel">
        {entries.map((entry) => (
          <ReviewEntryCard key={entry.id} entry={entry} showStudent />
        ))}
      </ul>
    </section>
  );
}

export function ApprovalQueue({ pending }: { pending: ReviewEntry[] }) {
  return (
    <div className="grid gap-6">
      {groupByDay(pending).map(([date, entries]) => (
        <Day key={date} date={date} entries={entries} />
      ))}
    </div>
  );
}

export function MissingTimeOut({ entries }: { entries: ReviewEntry[] }) {
  return (
    <section aria-label="Needs a time out" className="grid gap-2">
      <h2 className="px-1 font-heading text-lg font-bold text-ink">
        Needs a time out{" "}
        <span className="text-[15px] font-semibold tabular-nums text-copy-muted">({entries.length})</span>
      </h2>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-panel">
        {entries.map((entry) => (
          <ReviewEntryCard key={entry.id} entry={entry} showStudent />
        ))}
      </ul>
    </section>
  );
}
