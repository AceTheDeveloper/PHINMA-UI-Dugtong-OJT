"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Clock, LogOut } from "lucide-react";
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

// The punch card: the one thing on the student's home page. A deep navy top says
// where the day stands in one big figure and carries the action; a white bottom,
// when there is something to write or read, holds the journal. Times come from the
// server: the clock shown here is only a reminder of how long the entry has been
// open, and the server decides every time that is stored. The database checks the
// rest (schedule, window, reason).

function Shell({ top, bottom }: { top: ReactNode; bottom?: ReactNode }) {
  return (
    <section
      id="today"
      aria-label="Today"
      className="scroll-mt-20 overflow-hidden rounded-3xl border border-deep-border shadow-panel"
    >
      <div className="grid gap-5 bg-deep p-6 text-deep-foreground sm:p-8">{top}</div>
      {bottom ? <div className="grid gap-5 bg-card p-6 sm:p-8">{bottom}</div> : null}
    </section>
  );
}

function Label({ date, badge }: { date: string; badge?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[15px] font-semibold text-deep-muted">Today{date ? `, ${date}` : ""}</p>
      {badge}
    </div>
  );
}

const big =
  "font-heading text-[44px] font-bold leading-none tracking-[-0.04em] tabular-nums sm:text-[60px]";
const title = "font-heading text-[28px] font-bold leading-tight tracking-[-0.02em] sm:text-[34px]";

function Blocked({ date, heading, children }: { date: string; heading: string; children: ReactNode }) {
  return (
    <Shell
      top={
        <>
          <Label date={date} />
          <h2 className={title}>{heading}</h2>
          <p className="max-w-[56ch] text-base leading-[1.6] text-deep-muted">{children}</p>
        </>
      }
    />
  );
}

function TimeIn({ date, scheduleLabel }: { date: string; scheduleLabel: string }) {
  const { pending, message, run } = useAction();
  return (
    <Shell
      top={
        <>
          <Label date={date} />
          <h2 className={title}>Ready when you are</h2>
          <p className="text-base leading-[1.6] text-deep-muted">
            Your schedule today is{" "}
            <span className="font-semibold text-deep-foreground">{scheduleLabel}</span>.
          </p>
          <FormMessage message={message} />
          <div>
            <Button
              type="button"
              size="lg"
              disabled={pending}
              onClick={() => run(() => timeInAction())}
              className="h-14 w-full gap-2 bg-deep-action px-10 text-base font-semibold text-deep-action-foreground hover:bg-deep-action/90 sm:w-auto"
            >
              <Clock aria-hidden="true" className="size-5" />
              {pending ? "Timing in" : "Time in"}
            </Button>
          </div>
        </>
      }
    />
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
  date,
  entry,
  scheduledEndAt,
  scheduledEndLabel,
}: {
  date: string;
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
    <Shell
      top={
        <>
          <Label date={date} badge={<LogStatusBadge status="open" />} />
          <div className="grid gap-2">
            <p className="text-sm text-deep-muted">Timed in at</p>
            <p className={big}>{formatClock(entry.timeIn)}</p>
            <p className="min-h-7 text-lg font-semibold tabular-nums text-teal-bright" aria-live="off">
              {elapsed === null ? "" : `${formatDuration(elapsed)} so far`}
            </p>
          </div>
        </>
      }
      bottom={
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <label htmlFor="journal" className="text-base font-semibold text-ink">
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
            <p id="journal-hint" className="text-sm text-muted-foreground">
              Saved when you leave this box. Needed before you time out.
            </p>
          </div>

          {askReason ? (
            <div className="grid gap-1.5">
              <label htmlFor="early-reason" className="text-base font-semibold text-ink">
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
          <div>
            <Button type="submit" size="lg" disabled={pending} className="h-14 w-full gap-2 px-10 text-base sm:w-auto">
              <LogOut aria-hidden="true" className="size-5" />
              {pending ? "Timing out" : "Time out"}
            </Button>
          </div>
        </form>
      }
    />
  );
}

export function TodayCard({ view, dateLabel = "" }: { view: TodayView; dateLabel?: string }) {
  switch (view.kind) {
    case "none":
      return null;
    case "no_schedule":
      return (
        <Blocked date={dateLabel} heading="No schedule yet">
          Your supervisor has not set your work schedule yet. You can time in once they do.
        </Blocked>
      );
    case "off_day":
      return (
        <Blocked date={dateLabel} heading="Not a working day">
          Today is not one of your working days.
        </Blocked>
      );
    case "too_early":
      return (
        <Blocked date={dateLabel} heading={`Time in opens at ${view.opensAt}`}>
          You can time in from {view.opensAt}.
        </Blocked>
      );
    case "ended":
      return (
        <Blocked date={dateLabel} heading="Today has ended">
          Your scheduled time today has ended and you did not time in. Ask your supervisor.
        </Blocked>
      );
    case "ready":
      return <TimeIn date={dateLabel} scheduleLabel={view.scheduleLabel} />;
    case "entry": {
      const { entry } = view;
      if (entry.status === "open") {
        return (
          <Running
            date={dateLabel}
            entry={entry}
            scheduledEndAt={view.scheduledEndAt}
            scheduledEndLabel={view.scheduledEndLabel}
          />
        );
      }
      const times = entry.timeOut
        ? `${formatClock(entry.timeIn)} to ${formatClock(entry.timeOut)}`
        : formatClock(entry.timeIn);
      const showBottom = Boolean(entry.journal) || entry.status === "rejected";
      return (
        <Shell
          top={
            <>
              <Label date={dateLabel} badge={<LogStatusBadge status={entry.status} />} />
              <div className="grid gap-2">
                <p className={cn(big, "text-[34px] sm:text-[44px]")}>{times}</p>
                {entry.timeOut ? (
                  <p className="text-lg tabular-nums text-deep-muted">
                    {formatDuration(workedMinutes(entry))} worked
                  </p>
                ) : null}
              </div>
              <p className="text-base text-deep-muted">
                {entry.status === "pending" ? "Submitted. Your supervisor will review it." : null}
                {entry.status === "approved" ? "Approved. These hours count." : null}
                {entry.status === "rejected"
                  ? "Your supervisor sent this back. Fix it and send it again."
                  : null}
              </p>
            </>
          }
          bottom={
            showBottom ? (
              <>
                {entry.status === "rejected" && entry.rejectReason ? (
                  <p className="rounded-lg border border-error-border bg-error-tint px-3 py-2 text-sm text-error-text">
                    {entry.rejectReason}
                  </p>
                ) : null}
                {entry.journal ? (
                  <p className="max-w-[62ch] whitespace-pre-wrap text-[15px] leading-[1.6] text-ink wrap-break-word">
                    {entry.journal}
                  </p>
                ) : null}
                {entry.status === "rejected" ? (
                  <div>
                    <Link
                      href="/student/logs"
                      className={cn(buttonVariants({ size: "lg" }), "h-12 px-6", focusStyle)}
                    >
                      Fix and resubmit
                    </Link>
                  </div>
                ) : null}
              </>
            ) : undefined
          }
        />
      );
    }
  }
}
