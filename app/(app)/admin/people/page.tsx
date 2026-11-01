import type { Metadata } from "next";
import {
  EmptyState,
  InvitationStatusBadge,
  LoadError,
  PageHeader,
  Section,
} from "@/components/admin/admin-parts";
import {
  InviteAdminSheet,
  InviteCoordinatorSheet,
  RevokeButton,
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
import { getAcademics, getInvitations } from "@/lib/admin/queries";
import { requireRole } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "People | Dugtong OJT",
  robots: { index: false, follow: false },
};

const roleLabels = {
  admin: "Admin",
  coordinator: "Coordinator",
  supervisor: "Supervisor",
  student: "Student",
} as const;

export default async function PeoplePage() {
  await requireRole(["admin"]);
  const [invitations, academics] = await Promise.all([
    getInvitations({ roles: ["admin", "coordinator", "supervisor"] }),
    getAcademics(),
  ]);

  const courseOptions = academics.ok
    ? academics.data.flatMap((department) =>
        department.courses.map((course) => ({
          value: course.id,
          label: `${course.code} · ${department.code}`,
        })),
      )
    : [];

  return (
    <>
      <PageHeader
        title="People"
        description="Invite coordinators and admins, and follow every invitation you or a company owner sent. Supervisors are invited from their company page."
        actions={
          <>
            <InviteCoordinatorSheet courses={courseOptions} />
            <InviteAdminSheet />
          </>
        }
      />

      <Section
        title="Invitations"
        description="Pending invitations can be revoked. They expire after 7 days."
      >
        {!invitations.ok ? (
          <LoadError message={invitations.error.message} />
        ) : invitations.data.length === 0 ? (
          <EmptyState>No invitations yet. Invite the coordinator to start.</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>For</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent by</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.data.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell className="font-medium">{invitation.email}</TableCell>
                  <TableCell>
                    <RoleBadge role="neutral">{roleLabels[invitation.role]}</RoleBadge>
                  </TableCell>
                  <TableCell>{invitation.target ?? "None"}</TableCell>
                  <TableCell>
                    <InvitationStatusBadge status={invitation.status} />
                  </TableCell>
                  <TableCell>{invitation.sentBy ?? "None"}</TableCell>
                  <TableCell className="tabular-nums">
                    {formatDateTime(invitation.createdAt)}
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
        filter={{ tables: ["invitations", "coordinator_assignments", "users"] }}
        description="Changes to invitations, coordinator assignments, and accounts."
      />
    </>
  );
}
