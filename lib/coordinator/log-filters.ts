import { addDays } from "@/lib/logs/week";

// The filters of the coordinator's Daily logs screen. They live in the address,
// so a filtered view can be shared and the back button works. Everything from the
// address is checked here before it reaches a query: an unknown status, a
// malformed id or date, or a huge page size falls back to the default.

export const logStatusFilters = ["all", "pending", "stale", "no-time-out", "rejected", "approved"] as const;
export type LogStatusFilter = (typeof logStatusFilters)[number];

export const logStatusLabels: Record<LogStatusFilter, string> = {
  all: "All",
  pending: "Pending",
  stale: "Stale",
  "no-time-out": "No time out",
  rejected: "Rejected",
  approved: "Approved",
};

export const logPageSize = 50;
export const logMaxShown = 1000;

export type LogFilters = {
  status: LogStatusFilter;
  company: string | null;
  student: string | null;
  from: string | null;
  to: string | null;
  shown: number;
};

export type SearchParams = Record<string, string | string[] | undefined>;

export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function first(value: string | string[] | undefined): string | null {
  const item = Array.isArray(value) ? value[0] : value;
  return typeof item === "string" && item.trim() !== "" ? item.trim() : null;
}

export function validDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

export function parseLogFilters(params: SearchParams): LogFilters {
  const status = first(params.status);
  const company = first(params.company);
  const student = first(params.student);
  const shown = Number(first(params.shown));
  const from = validDate(first(params.from));
  const to = validDate(first(params.to));
  return {
    status: (logStatusFilters as readonly string[]).includes(status ?? "")
      ? (status as LogStatusFilter)
      : "all",
    company: company && uuid.test(company) ? company : null,
    student: student && uuid.test(student) ? student : null,
    // A range typed backwards is read the right way round.
    from: from && to && from > to ? to : from,
    to: from && to && from > to ? from : to,
    shown:
      Number.isInteger(shown) && shown >= logPageSize
        ? Math.min(logMaxShown, Math.ceil(shown / logPageSize) * logPageSize)
        : logPageSize,
  };
}

// The address that shows these filters, keeping only what differs from the
// default. `shown` is kept only when more than one page is open.
export function logFiltersHref(filters: LogFilters, change: Partial<LogFilters> = {}): string {
  const next = { ...filters, ...change };
  const query = new URLSearchParams();
  if (next.status !== "all") query.set("status", next.status);
  if (next.company) query.set("company", next.company);
  if (next.student) query.set("student", next.student);
  if (next.from) query.set("from", next.from);
  if (next.to) query.set("to", next.to);
  if (next.shown > logPageSize) query.set("shown", String(next.shown));
  const text = query.toString();
  return text ? `/coordinator/logs?${text}` : "/coordinator/logs";
}

// A pending entry is stale once it has waited more than the threshold in days
// (the same rule as the dashboard): its date is on or before this cutoff.
export function staleCutoff(today: string, thresholdDays: number): string {
  return addDays(today, -(thresholdDays + 1));
}
