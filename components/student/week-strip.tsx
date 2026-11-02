import { Check, Clock, Minus, X, type LucideIcon } from "lucide-react";
import { formatDuration } from "@/lib/logs/logic";
import type { WeekDay, WeekDayState } from "@/lib/logs/week";
import { cn } from "@/lib/utils";

// The week as seven stamped days, Monday to Sunday: a stamp for an approved day, a
// waiting mark for a pending one, a live dot for a day in progress, a dashed mark
// for a working day with no entry. Each day says what it is in words as well, for
// a screen reader; the colour is never the only signal (every state has its own
// shape).

const look: Record<WeekDayState, { circle: string; icon: LucideIcon | null; dot?: string }> = {
  approved: { circle: "border-success-border bg-success-tint text-success-text", icon: Check },
  pending: { circle: "border-warning-border bg-warning-tint text-warning-text", icon: Clock },
  open: { circle: "border-teal-border bg-teal-tint text-teal-text", icon: null, dot: "bg-teal-bright" },
  rejected: { circle: "border-error-border bg-error-tint text-error-text", icon: X },
  missed: { circle: "border-dashed border-error-border text-error-text", icon: Minus },
  today: { circle: "border-primary bg-card text-primary ring-4 ring-primary/15", icon: null, dot: "bg-primary" },
  upcoming: { circle: "border-border-strong text-faint", icon: null },
  off: { circle: "border-transparent text-faint", icon: null },
};

export function WeekStrip({
  days,
  approvedMinutes,
}: {
  days: WeekDay[];
  approvedMinutes: number;
}) {
  return (
    <section
      aria-label="This week"
      className="grid gap-5 rounded-3xl border border-border bg-card p-5 shadow-panel sm:p-8"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-heading text-xl font-bold tracking-[-0.01em] text-ink">This week</h2>
        <p className="text-[15px] tabular-nums text-copy-muted">
          <span className="font-semibold text-ink">{formatDuration(approvedMinutes)}</span> approved
        </p>
      </div>
      <ol className="grid grid-cols-7 gap-1 sm:gap-3">
        {days.map((day) => {
          const { circle, icon: Icon, dot } = look[day.state];
          return (
            <li
              key={day.date}
              aria-label={day.label}
              aria-current={day.isToday ? "date" : undefined}
              className={cn(
                "grid justify-items-center gap-2 rounded-2xl px-0.5 py-3 sm:px-2",
                day.isToday && "bg-surface",
              )}
            >
              <span aria-hidden="true" className="text-sm font-semibold text-copy-muted">
                {day.letter}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-9 place-items-center rounded-full border-2 sm:size-11",
                  circle,
                )}
              >
                {Icon ? <Icon className="size-4 sm:size-5" strokeWidth={2.75} /> : null}
                {dot ? <span className={cn("size-2.5 rounded-full", dot)} /> : null}
              </span>
              <span aria-hidden="true" className="text-[15px] font-semibold tabular-nums text-ink">
                {day.dayOfMonth}
              </span>
              <span aria-hidden="true" className="min-h-5 text-sm tabular-nums text-copy-muted">
                {day.minutes !== null && day.state !== "rejected"
                  ? `${Math.round((day.minutes / 60) * 10) / 10} h`
                  : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
