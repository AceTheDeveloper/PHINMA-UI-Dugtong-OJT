import { RoleBadge, type StatusRole } from "@/components/coordinator/status-badge";
import {
  actionLabel,
  changeLines,
  subjectOf,
  tableLabel,
} from "@/lib/admin/audit-format";
import { formatDateTime } from "@/lib/admin/format";
import type { AuditEntry } from "@/lib/admin/queries";

const actionRoles: Record<AuditEntry["action"], StatusRole> = {
  insert: "success",
  update: "info",
  delete: "neutral",
};

// One audited change per row: when, who, what. Each row opens to show the old
// and new values side by side. Used by the merged Audit log screen and by the
// History section on each Admin screen.
export function AuditList({ entries }: { entries: AuditEntry[] }) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {entries.map((entry) => {
        const lines = changeLines(entry);
        return (
          <li key={entry.id}>
            <details className="group">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm outline-none hover:bg-surface focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                <RoleBadge role={actionRoles[entry.action]}>{actionLabel(entry.action)}</RoleBadge>
                <span className="font-semibold text-ink">
                  {tableLabel(entry.table)} · {subjectOf(entry)}
                </span>
                <span className="text-muted-foreground">
                  by{" "}
                  {entry.actorName ??
                    (entry.source === "database" ? "the database (outside the app)" : "unknown")}
                </span>
                <time
                  dateTime={entry.createdAt}
                  className="ml-auto text-xs text-muted-foreground tabular-nums"
                >
                  {formatDateTime(entry.createdAt)}
                </time>
              </summary>
              <div className="border-t border-border bg-surface px-4 py-3">
                {lines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No values were recorded.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th scope="col" className="py-1 pr-4 font-semibold">
                          Field
                        </th>
                        <th scope="col" className="py-1 pr-4 font-semibold">
                          Old value
                        </th>
                        <th scope="col" className="py-1 font-semibold">
                          New value
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => (
                        <tr key={line.field} className="align-top">
                          <th scope="row" className="py-1 pr-4 text-left font-medium text-ink">
                            {line.field}
                          </th>
                          <td className="py-1 pr-4 break-words text-copy-muted tabular-nums">
                            {line.from ?? "None"}
                          </td>
                          <td className="py-1 break-words text-ink tabular-nums">
                            {line.to ?? "None"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
