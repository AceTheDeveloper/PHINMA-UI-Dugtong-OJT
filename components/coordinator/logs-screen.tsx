import Link from "next/link";
import { RoleBadge } from "@/components/coordinator/status-badge";
import { focusStyle } from "@/components/brand-link";
import { NativeSelect } from "@/components/admin/form-parts";
import { ReopenEntryDialog } from "@/components/admin/reopen-entry-dialog";
import { LogStatusBadge } from "@/components/student/log-status";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  logFiltersHref,
  logPageSize,
  logStatusFilters,
  logStatusLabels,
  type LogStatusFilter,
} from "@/lib/coordinator/log-filters";
import type { LogRow, LogsView } from "@/lib/coordinator/log-types";
import { formatClock, formatDuration, formatLogDate, workedMinutes } from "@/lib/logs/logic";
import { cn } from "@/lib/utils";

// The coordinator's Daily logs screen: every entry of the batch, newest first,
// with filters in the address. Read only: nothing here approves, rejects, or
// edits (AGENTS.md section 4). A stale entry says who can act on it.

const statusRole: Record<LogStatusFilter, string> = {
  all: "",
  pending: "text-warning-text",
  stale: "text-warning-text",
  "no-time-out": "text-warning-text",
  rejected: "text-error-text",
  approved: "text-success-text",
};

function Entry({
  row,
  studentBasePath = "/coordinator/students",
  canReopen = false,
}: {
  row: LogRow;
  studentBasePath?: string;
  canReopen?: boolean;
}) {
  const worked = workedMinutes({
    timeIn: row.timeIn,
    timeOut: row.timeOut,
    breakMinutes: row.breakMinutes,
  });
  return (
    <li className="grid gap-2 px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="grid min-w-0 gap-0.5">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <Link
              href={`${studentBasePath}/${row.studentId}`}
              className={cn(
                "font-heading text-[17px] font-bold leading-tight text-ink underline-offset-4 hover:underline",
                focusStyle,
              )}
            >
              {row.studentName}
            </Link>
            <span className="text-[15px] text-copy-muted">{formatLogDate(row.logDate)}</span>
          </p>
          <p className="text-[15px] tabular-nums text-copy-muted">
            <span className="font-mono">
              {formatClock(row.timeIn)}
              {row.timeOut ? ` to ${formatClock(row.timeOut)}` : ""}
            </span>
            {row.timeOut ? ` · ${formatDuration(worked)} worked` : null}
            {row.breakMinutes > 0 ? ` · ${row.breakMinutes} min break` : null}
            {" · "}
            {row.companyName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {row.stale ? (
            <RoleBadge role="warning" solid>
              <span className="tabular-nums">{row.daysWaiting}</span>&nbsp;days waiting
            </RoleBadge>
          ) : null}
          {row.noTimeOut ? <RoleBadge role="warning">No time out</RoleBadge> : null}
          <LogStatusBadge status={row.status} />
          {canReopen && row.status === "approved" ? (
            <ReopenEntryDialog
              logId={row.id}
              studentName={row.studentName}
              logDate={formatLogDate(row.logDate)}
            />
          ) : null}
        </div>
      </div>

      {row.status === "pending" && row.supervisors.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Waiting on {row.supervisors.join(", ")} at {row.companyName}.
        </p>
      ) : null}
      {row.earlyOutReason ? (
        <p className="text-sm text-muted-foreground">Timed out early: {row.earlyOutReason}</p>
      ) : null}
      {row.correctionReason ? (
        <p className="text-sm text-muted-foreground">
          {row.addedBySupervisor ? "Added by the supervisor" : "Corrected by the supervisor"}:{" "}
          {row.correctionReason}
        </p>
      ) : null}
      {row.reopenReason ? (
        <p className="text-sm text-muted-foreground">Reopened: {row.reopenReason}</p>
      ) : null}
      {row.journal ? (
        <p className="max-w-[62ch] whitespace-pre-wrap text-[15px] leading-[1.6] text-ink wrap-break-word">
          {row.journal}
        </p>
      ) : row.status !== "open" ? (
        <p className="text-sm text-muted-foreground">No journal.</p>
      ) : null}
      {row.status === "rejected" && row.rejectReason ? (
        <p className="rounded-lg border border-error-border bg-error-tint px-3 py-2 text-sm text-error-text">
          {row.rejectReason}
        </p>
      ) : null}
    </li>
  );
}

export function LogsScreen({
  view,
  basePath = "/coordinator/logs",
  studentBasePath = "/coordinator/students",
  canReopen = false,
}: {
  view: LogsView;
  basePath?: string;
  studentBasePath?: string;
  canReopen?: boolean;
}) {
  const { filters, counts } = view;
  const narrowed = Boolean(filters.company || filters.student || filters.from || filters.to);
  return (
    <div className="grid gap-6">
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {logStatusFilters.map((status) => {
          const current = filters.status === status;
          return (
            <Link
              key={status}
              href={logFiltersHref(filters, { status, shown: logPageSize }, basePath)}
              aria-current={current ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[15px] font-semibold transition-colors",
                current
                  ? "border-primary bg-primary-tint text-info-text"
                  : "border-border-strong bg-card text-ink hover:bg-surface",
                focusStyle,
              )}
            >
              {logStatusLabels[status]}
              <span className={cn("tabular-nums", current ? "" : statusRole[status] || "text-copy-muted")}>
                {counts[status]}
              </span>
            </Link>
          );
        })}
      </nav>

      <form
        method="get"
        action={basePath}
        aria-label="Filter entries"
        className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-panel sm:grid-cols-2 sm:p-5 lg:grid-cols-[1fr_1fr_auto_auto_auto]"
      >
        {filters.status !== "all" ? <input type="hidden" name="status" value={filters.status} /> : null}
        <label className="grid gap-1.5 text-sm font-semibold text-ink">
          Company
          <NativeSelect name="company" defaultValue={filters.company ?? ""}>
            <option value="">All companies</option>
            {view.companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </NativeSelect>
        </label>
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
              href={logFiltersHref(
                filters,
                {
                  company: null,
                  student: null,
                  from: null,
                  to: null,
                  shown: logPageSize,
                },
                basePath,
              )}
              className={cn(buttonVariants({ variant: "ghost" }), "h-11", focusStyle)}
            >
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      <p role="status" className="text-[15px] text-copy-muted">
        <span className="font-semibold tabular-nums text-ink">{view.total}</span>{" "}
        {view.total === 1 ? "entry" : "entries"}
        {filters.status !== "all" ? ` ${logStatusLabels[filters.status].toLowerCase()}` : ""}. An entry is
        stale once it has waited more than{" "}
        <span className="tabular-nums">{view.course.staleThresholdDays}</span> days.
      </p>

      {view.rows.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card px-6 py-12 text-center text-base text-copy-muted shadow-panel">
          {narrowed || filters.status !== "all"
            ? "No entries match these filters. Clear a filter to see more."
            : "No entries yet. They appear here once students start timing in."}
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-panel">
          {view.rows.map((row) => (
            <Entry
              key={row.id}
              row={row}
              studentBasePath={studentBasePath}
              canReopen={canReopen}
            />
          ))}
        </ul>
      )}

      {view.total > view.rows.length ? (
        <div>
          <Link
            href={logFiltersHref(filters, { shown: filters.shown + logPageSize }, basePath)}
            className={cn(buttonVariants({ variant: "outline" }), "h-11 px-5", focusStyle)}
          >
            Show {Math.min(logPageSize, view.total - view.rows.length)} more
          </Link>
        </div>
      ) : null}
    </div>
  );
}
