import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { AuditList } from "@/components/admin/audit-list";
import {
  EmptyState,
  LoadError,
  PageHeader,
} from "@/components/admin/admin-parts";
import { NativeSelect } from "@/components/admin/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auditTables } from "@/lib/admin/audit-format";
import {
  auditPageSize,
  getAudit,
  getAuditActors,
  type AuditQuery,
} from "@/lib/admin/queries";
import { requireRole } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Audit log | Dugtong OJT",
  robots: { index: false, follow: false },
};

const filters = z.object({
  table: z.string().optional(),
  actor: z.string().uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).optional(),
});

// A date typed in the form is a day in Manila, so it runs from midnight there.
function startOfDay(date: string) {
  return `${date}T00:00:00+08:00`;
}

function nextDay(date: string) {
  const next = new Date(`${date}T00:00:00+08:00`);
  next.setDate(next.getDate() + 1);
  return next.toISOString();
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["admin"]);
  const raw = await searchParams;
  const parsed = filters.safeParse(
    Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [
        key,
        Array.isArray(value) ? value[0] : value || undefined,
      ]),
    ),
  );
  const filter = parsed.success ? parsed.data : {};
  const tables = auditTables();

  const query: AuditQuery = {
    tables: filter.table && tables.some((t) => t.value === filter.table) ? [filter.table] : undefined,
    actorId: filter.actor,
    from: filter.from ? startOfDay(filter.from) : undefined,
    to: filter.to ? nextDay(filter.to) : undefined,
    page: filter.page,
  };
  const [result, actors] = await Promise.all([getAudit(query), getAuditActors()]);

  const filtered = Boolean(filter.table || filter.actor || filter.from || filter.to);
  const pageCount = result.ok ? Math.max(1, Math.ceil(result.data.total / auditPageSize)) : 1;
  const page = result.ok ? result.data.page : 1;

  function pageHref(target: number) {
    const params = new URLSearchParams();
    if (filter.table) params.set("table", filter.table);
    if (filter.actor) params.set("actor", filter.actor);
    if (filter.from) params.set("from", filter.from);
    if (filter.to) params.set("to", filter.to);
    params.set("page", String(target));
    return `/admin/audit?${params.toString()}`;
  }

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every recorded change across the system, newest first: who changed what, and when. Records cannot be edited or deleted."
      />

      <form
        method="get"
        className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
      >
        <div className="grid gap-1.5">
          <label htmlFor="audit-table" className="text-sm font-semibold text-ink">
            Record type
          </label>
          <NativeSelect id="audit-table" name="table" defaultValue={filter.table ?? ""}>
            <option value="">All types</option>
            {tables.map((table) => (
              <option key={table.value} value={table.value}>
                {table.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="audit-actor" className="text-sm font-semibold text-ink">
            Changed by
          </label>
          <NativeSelect id="audit-actor" name="actor" defaultValue={filter.actor ?? ""}>
            <option value="">Everyone</option>
            {actors.ok
              ? actors.data.map((actor) => (
                  <option key={actor.id} value={actor.id}>
                    {actor.name}
                  </option>
                ))
              : null}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="audit-from" className="text-sm font-semibold text-ink">
            From
          </label>
          <Input id="audit-from" name="from" type="date" defaultValue={filter.from} className="tabular-nums" />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="audit-to" className="text-sm font-semibold text-ink">
            To
          </label>
          <Input id="audit-to" name="to" type="date" defaultValue={filter.to} className="tabular-nums" />
        </div>
        <div className="flex gap-2">
          <Button type="submit">Apply filters</Button>
          {filtered ? (
            <Button variant="outline" nativeButton={false} render={<Link href="/admin/audit" />}>
              Clear filters
            </Button>
          ) : null}
        </div>
      </form>

      {!result.ok ? (
        <LoadError message={result.error.message} />
      ) : result.data.entries.length === 0 ? (
        <EmptyState>
          {filtered ? "No changes match these filters." : "No changes have been recorded yet."}
        </EmptyState>
      ) : (
        <div className="grid gap-4">
          <p className="text-sm text-muted-foreground tabular-nums">
            {result.data.total} {result.data.total === 1 ? "change" : "changes"}. Page {page} of{" "}
            {pageCount}.
          </p>
          <AuditList entries={result.data.entries} />
          <nav aria-label="Pages" className="flex items-center justify-between gap-2">
            {page > 1 ? (
              <Button variant="outline" nativeButton={false} render={<Link href={pageHref(page - 1)} />}>
                Previous page
              </Button>
            ) : (
              <span />
            )}
            {page < pageCount ? (
              <Button variant="outline" nativeButton={false} render={<Link href={pageHref(page + 1)} />}>
                Next page
              </Button>
            ) : null}
          </nav>
        </div>
      )}
    </>
  );
}
