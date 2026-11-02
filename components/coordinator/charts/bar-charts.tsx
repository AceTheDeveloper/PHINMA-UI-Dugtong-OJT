"use client";

import { focusRing, markTone, niceMax, Tooltip, useTip } from "./chart-parts";
import type { Bar } from "@/lib/coordinator/charts";
import { cn } from "@/lib/utils";

// Two ways to compare counts or hours. Bars are at most 24px thick, grow from one
// baseline, and are rounded only at the data end. The value is written at the
// tip, so the picture is readable without hovering; the tooltip repeats it and
// shows a long name in full.

type Formatter = (value: number) => string;

// Names down the left, one bar each, the value at the bar's tip.
export function HorizontalBars({
  bars,
  format,
  label,
}: {
  bars: Bar[];
  format: Formatter;
  label: string;
}) {
  const { tip, handlers } = useTip();
  const max = Math.max(...bars.map((bar) => bar.value), 1);
  return (
    <>
      <ul aria-label={label} className="grid gap-2.5">
        {bars.map((bar) => (
          <li
            key={bar.label}
            tabIndex={0}
            aria-label={`${bar.label}: ${format(bar.value)}`}
            {...handlers(bar.label, format(bar.value))}
            className={cn(
              "group grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 rounded-md sm:grid-cols-[minmax(0,12rem)_1fr]",
              focusRing,
            )}
          >
            <span className="truncate text-sm text-ink" title={bar.label}>
              {bar.label}
            </span>
            <span className="flex min-w-0 items-center gap-2 border-l border-border-strong">
              {bar.value > 0 ? (
                <span
                  aria-hidden="true"
                  style={{ width: `max(4px, ${(bar.value / max) * 82}%)` }}
                  className={cn("h-5 shrink rounded-r-[4px]", markTone)}
                />
              ) : null}
              <span className="shrink-0 font-mono text-sm tabular-nums text-ink">
                {format(bar.value)}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <Tooltip tip={tip} />
    </>
  );
}

// Categories along the bottom, one column each, the value on the cap.
export function Columns({
  bars,
  format,
  label,
}: {
  bars: Bar[];
  format: Formatter;
  label: string;
}) {
  const { tip, handlers } = useTip();
  const top = niceMax(Math.max(...bars.map((bar) => bar.value), 1));
  return (
    <>
      <div role="group" aria-label={label} className="grid gap-2">
        <div className="flex h-40 items-end gap-2 border-b border-border-strong">
          {bars.map((bar) => (
            <div
              key={bar.label}
              tabIndex={0}
              aria-label={`${bar.label}: ${format(bar.value)}`}
              {...handlers(bar.label, format(bar.value))}
              className={cn(
                "group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-md",
                focusRing,
              )}
            >
              <span className="font-mono text-sm tabular-nums text-ink">{format(bar.value)}</span>
              {bar.value > 0 ? (
                <span
                  aria-hidden="true"
                  style={{ height: `${(bar.value / top) * 82}%` }}
                  className={cn("w-full max-w-6 rounded-t-[4px]", markTone)}
                />
              ) : null}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          {bars.map((bar) => (
            <span key={bar.label} className="min-w-0 flex-1 text-center text-xs leading-tight text-copy-muted">
              {bar.label}
            </span>
          ))}
        </div>
      </div>
      <Tooltip tip={tip} />
    </>
  );
}
