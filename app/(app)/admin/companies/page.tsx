import type { Metadata } from "next";
import Link from "next/link";
import {
  CompanyStatusBadge,
  EmptyState,
  LoadError,
  PageHeader,
} from "@/components/admin/admin-parts";
import { AddCompanySheet } from "@/components/admin/forms";
import { HistorySection } from "@/components/admin/history-section";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCompanies } from "@/lib/admin/queries";
import { requireRole } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Companies | Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function CompaniesPage() {
  await requireRole(["admin"]);
  const result = await getCompanies();

  return (
    <>
      <PageHeader
        title="Companies"
        description="The partner companies the school provided. Open a company to invite its supervisors."
        actions={<AddCompanySheet />}
      />

      {!result.ok ? (
        <LoadError message={result.error.message} />
      ) : result.data.length === 0 ? (
        <EmptyState>Add the first partner company.</EmptyState>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Supervisors</TableHead>
                <TableHead className="text-right">Pending invitations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((company) => (
                <TableRow key={company.id}>
                  <TableCell>
                    <Link
                      href={`/admin/companies/${company.id}`}
                      className="font-semibold text-ink hover:text-primary hover:underline"
                    >
                      {company.name}
                    </Link>
                    {company.address ? (
                      <p className="text-xs text-muted-foreground">{company.address}</p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <CompanyStatusBadge status={company.status} />
                  </TableCell>
                  <TableCell>{company.ownerName ?? "No owner yet"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {company.supervisorCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {company.pendingInvitations}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <HistorySection
        filter={{ tables: ["companies", "supervisor_memberships"] }}
        description="Changes to companies and to who belongs to them."
      />
    </>
  );
}
