"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import {
  saveJournalAction,
  timeInAction,
  timeOutAction,
} from "@/app/(app)/student/logs/actions";
import { FormMessage, useAction } from "@/components/admin/form-parts";
import { focusStyle } from "@/components/brand-link";
import { LogStatusBadge } from "@/components/student/log-status";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatClock, formatDuration, workedMinutes } from "@/lib/logs/logic";
import { maxJournalLength, maxReasonLength } from "@/lib/logs/schemas";
import type { LogEntry, TodayView } from "@/lib/logs/types";
import { cn } from "@/lib/utils";

// The daily action. One tap on "Time in" starts the entry; later the journal and
// "Time out" finish it. Times come from the server: the clock shown here is only
// a reminder of how long the entry has been open, and the server decides every
// time that is stored. The database checks the rest (schedule, window, reason).

const panel = "grid gap-5 rounded-3xl border border-border bg-card p-6 shadow-panel sm:p-8";

function Heading({ title, badge }: { title: string; badge?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-heading text-xl font-bold leading-tight text-ink">{title}</h2>
      {badge}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="max-w-[56ch] text-[15px] leading-[1.6] text-copy-muted">{children}</p>;
}

function TimeIn({ scheduleLabel }: { scheduleLabel: string }) {
  const { pending, message, run } = useAction();
  return (
    <section id="today" aria-label="Today" className={`${panel} scroll-mt-20`}>
      <Heading title="Today" />
      <Note>
        Your schedule today is <span className="font-semibold text-ink">{scheduleLabel}</span>.
      </Note>
      <FormMessage message={message} />
      <Button
        type="button"
        size="lg"
        disabled={pending}
        onClick={() => run(() => timeInAction())}
        className="h-14 w-full text-base sm:w-fit sm:px-10"
      >
        <Clock aria-hidden="true" className="size-5" />
        {pending ? "Timing in" : "Time in"}
      </Button>
    </section>
  );
}

function Blocked({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section id="today" aria-label="Today" className={`${panel} scroll-mt-20`}>
      <Heading title={title} />
      <Note>{children}</Note>
    </section>
  );
}

// This device's clock, refreshed while the page is open. It starts empty so the
// server and browser render the same thing, then fills in after mount. Display
// only: nothing stored ever comes from it.
function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 30000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);
  return now;
}

function Running({
  entry,
  scheduledEndAt,
  scheduledEndLabel,
}: {
  entry: LogEntry;
  scheduledEndAt: string | null;
  scheduledEndLabel: string | null;
}) {
  const { pending, message, run } = useAction();
  const saving = useAction();
  const [journal, setJournal] = useState(entry.journal ?? "");
  const [reason, setReason] = useState("");
  const [needReason, setNeedReason] = useState(false);
  const now = useNow();
  const elapsed =
    now === null ? null : Math.max(0, Math.floor((now - Date.parse(entry.timeIn)) / 60000));
  // Whether the scheduled end is still ahead on this device. The database
  // decides whether a reason is needed.
  const early = scheduledEndAt !== null && now !== null && now < Date.parse(scheduledEndAt);
  const askReason = early || needReason;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(async () => {
      const result = await timeOutAction({
        logId: entry.id,
        journal,
        earlyOutReason: askReason ? reason : undefined,
      });
      if (!result.ok && /reason/i.test(result.error.message)) setNeedReason(true);
      return result;
    });
  }

  return (
    <section id="today" aria-label="Today" className={`${panel} scroll-mt-20`}>
      <Heading title="Today" badge={<LogStatusBadge status="open" />} />
      <div className="grid gap-1">
        <p className="text-sm text-muted-foreground">Timed in at</p>
        <p className="font-mono text-[40px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-ink sm:text-[48px]">
          {formatClock(entry.timeIn)}
        </p>
        <p className="min-h-6 text-[15px] tabular-nums text-copy-muted" aria-live="off">
          {elapsed === null ? "" : `${formatDuration(elapsed)} so far`}
        </p>
      </div>

      <form onSubmit={submit} className="grid gap-4" noValidate>
        <div className="grid gap-1.5">
          <label htmlFor="journal" className="text-sm font-semibold text-ink">
            What did you do today?
          </label>
          <Textarea
            id="journal"
            value={journal}
            maxLength={maxJournalLength}
            rows={5}
            onChange={(event) => setJournal(event.target.value)}
            onBlur={() => {
              if (journal !== (entry.journal ?? "")) {
                saving.run(() => saveJournalAction({ logId: entry.id, journal }));
              }
            }}
            aria-describedby="journal-hint"
          />
          <p id="journal-hint" className="text-xs text-muted-foreground">
            Saved when you leave this box. Needed before you time out.
          </p>
        </div>

        {askReason ? (
          <div className="grid gap-1.5">
            <label htmlFor="early-reason" className="text-sm font-semibold text-ink">
              {scheduledEndLabel
                ? `Why are you timing out before ${scheduledEndLabel}?`
                : "Why are you timing out early?"}
            </label>
            <Textarea
              id="early-reason"
              value={reason}
              maxLength={maxReasonLength}
              rows={2}
              onChange={(event) => setReason(event.target.value)}
              className="min-h-16"
            />
          </div>
        ) : null}

        <FormMessage message={saving.message ?? message} />
        <Button type="submit" size="lg" disabled={pending} className="h-14 w-full text-base sm:w-fit sm:px-10">
          {pending ? "Timing out" : "Time out"}
        </Button>
      </form>
    </section>
  );
}

function Summary({ entry }: { entry: LogEntry }) {
  const times = entry.timeOut
    ? `${formatClock(entry.timeIn)} to ${formatClock(entry.timeOut)}`
    : formatClock(entry.timeIn);
  return (
    <>
      <div className="grid gap-1">
        <p className="font-mono text-2xl font-semibold tabular-nums text-ink">{times}</p>
        {entry.timeOut ? (
          <p className="text-[15px] tabular-nums text-copy-muted">
            {formatDuration(workedMinutes(entry))} worked
          </p>
        ) : null}
      </div>
      {entry.journal ? (
        <p className="max-w-[62ch] whitespace-pre-wrap text-[15px] leading-[1.6] text-ink wrap-break-word">
          {entry.journal}
        </p>
      ) : null}
    </>
  );
}

export function TodayCard({ view }: { view: TodayView }) {
  switch (view.kind) {
    case "none":
      return null;
    case "no_schedule":
      return (
        <Blocked title="Today">
          Your supervisor has not set your work schedule yet. You can time in once they do.
        </Blocked>
      );
    case "off_day":
      return <Blocked title="Today">Today is not one of your working days.</Blocked>;
    case "too_early":
      return <Blocked title="Today">You can time in from {view.opensAt}.</Blocked>;
    case "ended":
      return (
        <Blocked title="Today">
          Your scheduled time today has ended and you did not time in. Ask your supervisor.
        </Blocked>
      );
    case "ready":
      return <TimeIn scheduleLabel={view.scheduleLabel} />;
    case "entry": {
      const { entry } = view;
      if (entry.status === "open") {
        return (
          <Running
            entry={entry}
            scheduledEndAt={view.scheduledEndAt}
            scheduledEndLabel={view.scheduledEndLabel}
          />
        );
      }
      return (
        <section id="today" aria-label="Today" className={`${panel} scroll-mt-20`}>
          <Heading title="Today" badge={<LogStatusBadge status={entry.status} />} />
          <Summary entry={entry} />
          {entry.status === "pending" ? (
            <Note>Submitted. Your supervisor will review it.</Note>
          ) : null}
          {entry.status === "approved" ? <Note>Approved. These hours count.</Note> : null}
          {entry.status === "rejected" ? (
            <>
              {entry.rejectReason ? (
                <p className="rounded-lg border border-error-border bg-error-tint px-3 py-2 text-sm text-error-text">
                  {entry.rejectReason}
                </p>
              ) : null}
              <Link
                href="/student/logs"
                className={cn(buttonVariants({ size: "lg" }), "h-11 w-fit px-6", focusStyle)}
              >
                Fix and resubmit
              </Link>
            </>
          ) : null}
        </section>
      );
    }
  }
}
