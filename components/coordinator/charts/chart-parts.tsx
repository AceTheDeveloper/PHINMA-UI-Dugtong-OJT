"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// The pieces every dashboard chart is built from: a card with a title, a note,
// a table view (the accessible twin of the picture), and one shared tooltip.
// Charts here are plain HTML and SVG drawn with the design tokens, so they follow
// light and dark without a chart library.

export type Tip = { x: number; y: number; label: string; value: string };

export function useTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  // Hover and keyboard focus show the same readout.
  const handlers = (label: string, value: string) => ({
    onPointerMove: (event: React.PointerEvent) =>
      setTip({ x: event.clientX, y: event.clientY, label, value }),
    onPointerLeave: () => setTip(null),
    onFocus: (event: React.FocusEvent<HTMLElement>) => {
      const box = event.currentTarget.getBoundingClientRect();
      setTip({ x: box.left + box.width / 2, y: box.top, label, value });
    },
    onBlur: () => setTip(null),
  });
  return { tip, handlers };
}

// Values lead, the name follows. Fixed to the pointer, never clipped by a card.
export function Tooltip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div
      role="tooltip"
      style={{ left: tip.x, top: tip.y }}
      className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg border border-border bg-popover px-3 py-2 shadow-panel"
    >
      <p className="font-mono text-sm font-semibold tabular-nums text-ink">{tip.value}</p>
      <p className="text-xs text-copy-muted">{tip.label}</p>
    </div>
  );
}

export type ChartTable = { head: [string, string]; rows: [string, string][] };

export function ChartCard({
  title,
  note,
  table,
  empty,
  children,
}: {
  title: string;
  note: string;
  table: ChartTable;
  // When set, the picture is replaced by this sentence (nothing to plot).
  empty?: string;
  children: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <figure className="grid min-w-0 content-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-panel sm:p-6">
      <figcaption className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-base font-bold text-ink">{title}</h3>
          <p className="text-sm text-copy-muted">{note}</p>
        </div>
        {empty ? null : (
          <button
            type="button"
            aria-pressed={asTable}
            onClick={() => setAsTable((current) => !current)}
            className="inline-flex min-h-8 shrink-0 items-center rounded-lg px-2 text-sm font-semibold text-primary outline-none hover:bg-primary-tint focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:min-h-11"
          >
            {asTable ? "Show chart" : "Show table"}
          </button>
        )}
      </figcaption>

      {empty ? (
        <p className="rounded-lg border border-dashed border-border-strong px-4 py-8 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : asTable ? (
        <table className="w-full text-sm">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="border-b border-border text-left text-copy-muted">
              <th scope="col" className="py-2 pr-4 font-semibold">
                {table.head[0]}
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                {table.head[1]}
              </th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map(([label, value]) => (
              <tr key={label} className="border-b border-border last:border-0">
                <th scope="row" className="py-2 pr-4 text-left font-normal text-ink">
                  {label}
                </th>
                <td className="py-2 text-right font-mono tabular-nums text-ink">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        children
      )}
    </figure>
  );
}

// A clean top for an axis: 1, 2, 5, or 10 times a power of ten, never below 1.
export function niceMax(value: number): number {
  if (value <= 1) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const fraction = value / power;
  const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return step * power;
}

export function hoursLabel(value: number): string {
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1);
  // Thousands get a separator: 2,286 h reads faster than 2286 h.
  const [whole, decimals] = text.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${decimals ? `${grouped}.${decimals}` : grouped} h`;
}

export const markTone = "bg-primary transition-colors group-hover:bg-primary-hover group-focus-visible:bg-primary-hover";

export const focusRing = cn("outline-none focus-visible:ring-3 focus-visible:ring-ring/50");
