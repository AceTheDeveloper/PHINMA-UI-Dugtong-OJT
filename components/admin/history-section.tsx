import Link from "next/link";
import { AuditList } from "@/components/admin/audit-list";
import { EmptyState, LoadError, Section } from "@/components/admin/admin-parts";
import { getAudit, type AuditQuery } from "@/lib/admin/queries";

// The recent history of this screen's own records, read from the same audit
// log as the merged Audit log screen. Shows the latest changes and links to
// the full log.
export async function HistorySection({
  filter,
  description,
}: {
  filter: AuditQuery;
  description: string;
}) {
  const result = await getAudit(filter);
  return (
    <Section
      title="History"
      description={description}
      actions={
        <Link href="/admin/audit" className="text-sm font-medium text-primary hover:underline">
          Open audit log
        </Link>
      }
    >
      {!result.ok ? (
        <LoadError message={result.error.message} />
      ) : result.data.entries.length === 0 ? (
        <EmptyState>No changes yet.</EmptyState>
      ) : (
        <div className="grid gap-3">
          <AuditList entries={result.data.entries.slice(0, 10)} />
          {result.data.total > 10 ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              Showing the latest 10 of {result.data.total} changes.
            </p>
          ) : null}
        </div>
      )}
    </Section>
  );
}
