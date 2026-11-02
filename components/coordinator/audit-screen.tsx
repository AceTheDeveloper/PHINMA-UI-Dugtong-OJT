import Link from "next/link";
import { focusStyle } from "@/components/brand-link";
import { NativeSelect } from "@/components/admin/form-parts";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/admin/format";
import {
  auditFiltersHref,
  auditKindLabels,
  auditKinds,
} from "@/lib/coordinator/audit-filters";
import type { AuditView } from "@/lib/coordinator/audit-queries";
import { logPageSize } from "@/lib/coordinator/log-filters";
import { cn } from "@/lib/utils";

// The coordinator's Audit log: what changed in their course, in plain sentences,
// newest first. Read only. Journals and comments never appear here.

export function AuditScreen({ view }: { view: AuditView }) {
  const { filters } = view;
  const narrowed = Boolean(filters.student || filters.from || filters.to);
  return (
    <div className="grid gap-6">
      <nav aria-label="Filter by kind" className="flex flex-wrap gap-2">
        {auditKinds.map((kind) => {
          const current = filters.kind === kind;
          return (
            <Link
              key={kind}
              href={auditFiltersHref(filters, { kind, shown: logPageSize })}
              aria-current={current ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full border px-4 text-[15px] font-semibold transition-colors",
                current
                  ? "border-primary bg-primary-tint text-info-text"
                  : "border-border-strong bg-card text-ink hover:bg-surface",
                focusStyle,
              )}
            >
              {auditKindLabels[kind]}
            </Link>
          );
        })}
      </nav>

      <form
        method="get"
        action="/coordinator/audit"
        aria-label="Filter changes"
        className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-panel sm:grid-cols-2 sm:p-5 lg:grid-cols-[1fr_auto_auto_auto]"
      >
        {filters.kind !== "all" ? <input type="hidden" name="kind" value={filters.kind} /> : null}
        <label className="grid gap-1.5 text-sm font-semibold text-ink">
          Student
          <NativeSelect name="student" defaultValue={filters.student ?? ""}>
            <option value="">All students</option>
            {view.students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-ink">
          From
          <Input type="date" name="from" defaultValue={filters.from ?? ""} className="h-11 tabular-nums" />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-ink">
          To
          <Input type="date" name="to" defaultValue={filters.to ?? ""} className="h-11 tabular-nums" />
        </label>
        <div className="flex items-end gap-2">
          <Button type="submit" className="h-11 px-5">
            Apply filters
          </Button>
          {narrowed ? (
            <Link
              href={auditFiltersHref(filters, { student: null, from: null, to: null, shown: logPageSize })}
              className={cn(buttonVariants({ variant: "ghost" }), "h-11", focusStyle)}
            >
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {view.items.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card px-6 py-12 text-center text-base text-copy-muted shadow-panel">
          {narrowed || filters.kind !== "all"
            ? "No changes match these filters. Clear a filter to see more."
            : "Nothing has changed in your course yet."}
        </p>
      ) : (
        <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-panel">
          {view.items.map((item) => (
            <li key={item.id} className="grid gap-1 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-6 sm:px-6">
              <p className="max-w-[70ch] text-base leading-[1.5] text-ink wrap-break-word">
                {item.studentId ? (
                  <Link
                    href={`/coordinator/students/${item.studentId}`}
                    className={cn("underline-offset-4 hover:underline", focusStyle)}
                  >
                    {item.text}
                  </Link>
                ) : (
                  item.text
                )}
              </p>
              <p className="text-sm tabular-nums text-muted-foreground">{formatDateTime(item.at)}</p>
            </li>
          ))}
        </ol>
      )}

      {view.more ? (
        <div>
          <Link
            href={auditFiltersHref(filters, { shown: filters.shown + logPageSize })}
            className={cn(buttonVariants({ variant: "outline" }), "h-11 px-5", focusStyle)}
          >
            Show more
          </Link>
        </div>
      ) : null}
    </div>
  );
}
