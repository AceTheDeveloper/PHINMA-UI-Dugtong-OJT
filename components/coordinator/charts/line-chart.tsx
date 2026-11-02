"use client";

import { focusRing, niceMax, Tooltip, useTip } from "./chart-parts";
import type { Bar } from "@/lib/coordinator/charts";
import { cn } from "@/lib/utils";

// A single series over time: a 2px line with a faint wash beneath, one dot per
// point, and the latest value written beside the last dot. The line is SVG
// stretched to the card; the dots and the labels are HTML placed by percentage,
// so text is never squashed. Every dot has a 24px hit area for pointer and
// keyboard.

type Formatter = (value: number) => string;

const plotHeight = 144;

export function LineChart({
  points,
  format,
  label,
}: {
  points: Bar[];
  format: Formatter;
  label: string;
}) {
  const { tip, handlers } = useTip();
  const top = niceMax(Math.max(...points.map((point) => point.value), 1));
  const last = points.length - 1;
  const x = (index: number) => (last === 0 ? 50 : (index / last) * 100);
  const y = (value: number) => 100 - (value / top) * 100;
  const line = points.map((point, index) => `${x(index)},${y(point.value)}`).join(" ");
  const area = `0,100 ${line} 100,100`;
  const ticks = [top, top / 2, 0];

  return (
    <>
      <div role="group" aria-label={label} className="grid grid-cols-[2.5rem_1fr] gap-x-2">
        <div className="relative" style={{ height: plotHeight }} aria-hidden="true">
          {ticks.map((tick) => (
            <span
              key={tick}
              style={{ top: `${y(tick)}%` }}
              className="absolute right-0 -translate-y-1/2 font-mono text-xs tabular-nums text-copy-muted"
            >
              {Number.isInteger(tick) ? tick : tick.toFixed(1)}
            </span>
          ))}
        </div>
        <div className="relative" style={{ height: plotHeight }}>
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="absolute inset-0 size-full overflow-visible"
          >
            {ticks.map((tick) => (
              <line
                key={tick}
                x1="0"
                x2="100"
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--border)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <polygon points={area} fill="var(--primary)" opacity="0.1" />
            <polyline
              points={line}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {points.map((point, index) => (
            <button
              key={point.label}
              type="button"
              aria-label={`${point.label}: ${format(point.value)}`}
              {...handlers(`Week of ${point.label}`, format(point.value))}
              style={{ left: `${x(index)}%`, top: `${y(point.value)}%` }}
              className={cn(
                "absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full",
                focusRing,
              )}
            >
              <span
                className={cn(
                  "rounded-full bg-primary ring-2 ring-card",
                  index === last ? "size-2.5" : "size-2",
                )}
              />
            </button>
          ))}
          {last >= 0 ? (
            <span
              style={{ left: `${x(last)}%`, top: `${y(points[last].value)}%` }}
              className="pointer-events-none absolute -translate-x-full -translate-y-[170%] whitespace-nowrap pr-1 font-mono text-sm font-semibold tabular-nums text-ink"
            >
              {format(points[last].value)}
            </span>
          ) : null}
        </div>
        <span aria-hidden="true" />
        <div className="relative mt-1 h-5">
          {points.map((point, index) =>
            index === 0 || index === last || (index % 2 === 0 && index < last - 1) ? (
              <span
                key={point.label}
                style={{ left: `${x(index)}%` }}
                className="absolute -translate-x-1/2 whitespace-nowrap text-xs text-copy-muted"
              >
                {point.label}
              </span>
            ) : null,
          )}
        </div>
      </div>
      <Tooltip tip={tip} />
    </>
  );
}
