import {
  first,
  logMaxShown,
  logPageSize,
  uuid,
  validDate,
  type SearchParams,
} from "@/lib/coordinator/log-filters";

// The filters of the coordinator's Audit log. Like the Daily logs, they live in
// the address and everything from it is checked before it reaches a query.

export const auditKinds = [
  "all",
  "entries",
  "evaluations",
  "certifications",
  "placements",
  "hours",
  "roster",
] as const;
export type AuditKind = (typeof auditKinds)[number];

export const auditKindLabels: Record<AuditKind, string> = {
  all: "All",
  entries: "Entries",
  evaluations: "Evaluations",
  certifications: "Certifications",
  placements: "Placements",
  hours: "Required hours",
  roster: "Roster",
};

export type AuditFilters = {
  kind: AuditKind;
  student: string | null;
  from: string | null;
  to: string | null;
  shown: number;
};

export function parseAuditFilters(params: SearchParams): AuditFilters {
  const kind = first(params.kind);
  const student = first(params.student);
  const shown = Number(first(params.shown));
  const from = validDate(first(params.from));
  const to = validDate(first(params.to));
  return {
    kind: (auditKinds as readonly string[]).includes(kind ?? "") ? (kind as AuditKind) : "all",
    student: student && uuid.test(student) ? student : null,
    from: from && to && from > to ? to : from,
    to: from && to && from > to ? from : to,
    shown:
      Number.isInteger(shown) && shown >= logPageSize
        ? Math.min(logMaxShown, Math.ceil(shown / logPageSize) * logPageSize)
        : logPageSize,
  };
}

export function auditFiltersHref(filters: AuditFilters, change: Partial<AuditFilters> = {}): string {
  const next = { ...filters, ...change };
  const query = new URLSearchParams();
  if (next.kind !== "all") query.set("kind", next.kind);
  if (next.student) query.set("student", next.student);
  if (next.from) query.set("from", next.from);
  if (next.to) query.set("to", next.to);
  if (next.shown > logPageSize) query.set("shown", String(next.shown));
  const text = query.toString();
  return text ? `/coordinator/audit?${text}` : "/coordinator/audit";
}
