"use client";

import { useState } from "react";
import { setWorkScheduleAction } from "@/app/(app)/supervisor/students/actions";
import { FormField, FormMessage, SubmitRow, useAction } from "@/components/admin/form-parts";
import { Input } from "@/components/ui/input";
import { weekdayNames } from "@/lib/schedules/logic";
import type { ScheduleDay } from "@/lib/schedules/types";
import { cn } from "@/lib/utils";

// The schedule form: one row per weekday with a checkbox and a start and end
// time. The date it starts on defaults to today and cannot be in the past. The
// server checks the supervisor's company, the date, and the days again.

type Row = { weekday: number; on: boolean; start: string; end: string };

const defaultStart = "08:00";
const defaultEnd = "17:00";

function initialRows(days: readonly ScheduleDay[]): Row[] {
  const byWeekday = new Map(days.map((day) => [day.weekday, day]));
  const hasDays = days.length > 0;
  return weekdayNames.map((_, index) => {
    const weekday = index + 1;
    const own = byWeekday.get(weekday);
    return {
      weekday,
      on: own ? true : !hasDays && weekday <= 5,
      start: own?.start ?? defaultStart,
      end: own?.end ?? defaultEnd,
    };
  });
}

export function ScheduleForm({
  deploymentId,
  today,
  startingDays,
}: {
  deploymentId: string;
  today: string;
  startingDays: readonly ScheduleDay[];
}) {
  const { pending, message, run } = useAction();
  const [rows, setRows] = useState<Row[]>(() => initialRows(startingDays));
  const [from, setFrom] = useState(today);
  const [notice, setNotice] = useState<string | null>(null);

  function update(weekday: number, change: Partial<Row>) {
    setNotice(null);
    setRows((current) =>
      current.map((row) => (row.weekday === weekday ? { ...row, ...change } : row)),
    );
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const days = rows
      .filter((row) => row.on)
      .map(({ weekday, start, end }) => ({ weekday, start, end }));
    run(
      () => setWorkScheduleAction({ deploymentId, effectiveFrom: from, days }),
      () => setNotice("Schedule saved."),
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <FormField id="schedule-from" label="Starts on" hint="Earlier days keep the schedule they had.">
        <Input
          id="schedule-from"
          type="date"
          min={today}
          value={from}
          onChange={(event) => {
            setNotice(null);
            setFrom(event.target.value);
          }}
          className="max-w-56"
        />
      </FormField>

      <fieldset className="grid gap-1">
        <legend className="mb-1 text-sm font-semibold text-ink">Working days</legend>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
          {rows.map((row) => {
            const name = weekdayNames[row.weekday - 1];
            return (
              <li
                key={row.weekday}
                className={cn(
                  "grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,10rem)_1fr] sm:items-center",
                  !row.on && "bg-surface",
                )}
              >
                <label className="flex min-h-11 items-center gap-3 text-[15px] font-semibold text-ink">
                  <input
                    type="checkbox"
                    checked={row.on}
                    onChange={(event) => update(row.weekday, { on: event.target.checked })}
                    className="size-5 shrink-0 accent-primary"
                  />
                  {name}
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-copy-muted">
                    <span className="w-10">Start</span>
                    <Input
                      type="time"
                      value={row.start}
                      disabled={!row.on}
                      aria-label={`${name} start time`}
                      onChange={(event) => update(row.weekday, { start: event.target.value })}
                      className="w-32 font-mono tabular-nums"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-copy-muted">
                    <span className="w-10">End</span>
                    <Input
                      type="time"
                      value={row.end}
                      disabled={!row.on}
                      aria-label={`${name} end time`}
                      onChange={(event) => update(row.weekday, { end: event.target.value })}
                      className="w-32 font-mono tabular-nums"
                    />
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">
          An end earlier than the start is a night shift that ends the next day.
        </p>
      </fieldset>

      <FormMessage message={message} />
      {notice ? (
        <p
          role="status"
          className="rounded-lg border border-success-border bg-success-tint px-3 py-2 text-sm text-success-text"
        >
          {notice}
        </p>
      ) : null}
      <SubmitRow label="Save schedule" pendingLabel="Saving schedule" pending={pending} />
    </form>
  );
}
