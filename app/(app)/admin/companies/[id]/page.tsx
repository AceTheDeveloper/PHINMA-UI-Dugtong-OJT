import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  CompanyStatusBadge,
  EmptyState,
  InvitationStatusBadge,
  LoadError,
  PageHeader,
  Section,
} from "@/components/admin/admin-parts";
import {
  CompanyStatusButton,
  InviteSupervisorSheet,
  RevokeButton,
  TransferOwnershipButton,
} from "@/components/admin/forms";
import { HistorySection } from "@/components/admin/history-section";
import { RoleBadge } from "@/components/coordinator/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/admin/format";
import { getCompany } from "@/lib/admin/queries";
import { requireRole } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Company | Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin"]);
  const { id } = await params;
  const result = await getCompany(id);
  if (!result.ok) return <LoadError message={result.error.message} />;
  if (result.data === null) notFound();

  const { company, supervisors, invitations, historyRowIds } = result.data;

  return (
    <>
      <Link
        href="/admin/companies"
        className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to companies
      </Link>
      <PageHeader
        title={company.name}
        description={company.address ?? "No address on file."}
        actions={
          <InviteSupervisorSheet
            companyId={company.id}
            companyName={company.name}
            disabled={company.status !== "active"}
          />
        }
      />

      <Section
        title="Status"
        description="An inactive company cannot receive new supervisor invitations."
        actions={<CompanyStatusBadge status={company.status} />}
      >
        <CompanyStatusButton companyId={company.id} status={company.status} />
      </Section>

      <Section
        title="Supervisors"
        description="The first supervisor to accept an invitation is the company owner."
      >
        {supervisors.length === 0 ? (
          <EmptyState>No supervisor has joined yet. Invite the first one.</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {supervisors.map((supervisor) => (
                <TableRow key={supervisor.userId}>
                  <TableCell className="font-medium">{supervisor.name}</TableCell>
                  <TableCell>{supervisor.email}</TableCell>
                  <TableCell>
                    {supervisor.isOwner ? (
                      <RoleBadge role="teal">Owner</RoleBadge>
                    ) : (
                      <RoleBadge role="neutral">Supervisor</RoleBadge>
                    )}
                  </TableCell>
                  <TableCell>
                    {supervisor.isActive ? (
                      <RoleBadge role="success">Active</RoleBadge>
                    ) : (
                      <RoleBadge role="neutral">Deactivated</RoleBadge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!supervisor.isOwner && supervisor.isActive ? (
                      <TransferOwnershipButton
                        companyId={company.id}
                        newOwnerId={supervisor.userId}
                        name={supervisor.name}
                      />
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <Section title="Invitations" description="Invitations sent for this company.">
        {invitations.length === 0 ? (
          <EmptyState>No invitations sent yet.</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell className="font-medium">{invitation.email}</TableCell>
                  <TableCell>
                    <InvitationStatusBadge status={invitation.status} />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatDateTime(invitation.createdAt)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatDateTime(invitation.expiresAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {invitation.status === "pending" ? (
                      <RevokeButton invitationId={invitation.id} />
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <HistorySection
        filter={{ rowIds: historyRowIds }}
        description="Changes to this company, its supervisors, and its invitations."
      />
    </>
  );
}
