import type { Metadata } from "next";
import { EmptyState, LoadError, PageHeader, Section } from "@/components/admin/admin-parts";
import { RoleBadge } from "@/components/coordinator/status-badge";
import { ResendButton, SendInvitationsButton } from "@/components/roster/invite-controls";
import { RosterImporter } from "@/components/roster/roster-importer";
import { InviteStatusBadge, needsInvitation } from "@/components/roster/roster-status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth/server";
import { getBatchOptions, getRoster } from "@/lib/roster/queries";
import type { InviteState } from "@/lib/roster/types";

export const metadata: Metadata = {
  title: "Roster import | Dugtong OJT",
  robots: { index: false, follow: false },
};

const resendLabels: Record<InviteState, string | null> = {
  not_invited: "Send invitation",
  pending: "Resend",
  expired: "Send again",
  revoked: "Send again",
  accepted: null,
};

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(["coordinator", "admin"]);
  const query = await searchParams;
  const wanted = typeof query.batch === "string" ? query.batch : undefined;

  const options = await getBatchOptions(session);
  if (!options.ok) {
    return (
      <>
        <PageHeader title="Roster import" description="Import the student list for an OJT batch." />
        <LoadError message={options.error.message} />
      </>
    );
  }

  // Only batches the caller may import into are ever offered, so this is also
  // the scope check for the list below.
  const selected = options.data.find((batch) => batch.id === wanted) ?? options.data[0];
  const roster = selected ? await getRoster(selected.id) : null;
  const waiting = roster?.ok
    ? roster.data.filter((student) => needsInvitation(student.status)).length
    : 0;

  return (
    <>
      <PageHeader
        title="Roster import"
        description="Upload the student list, check the preview, then commit it. Students receive an invitation only when you send it."
      />

      {!selected ? (
        <EmptyState>
          There is no open OJT batch in your courses. Ask the admin to add a batch first.
        </EmptyState>
      ) : (
        <>
          <RosterImporter key={selected.id} batches={options.data} selectedBatchId={selected.id} />

          <Section
            title={`Students in ${selected.label}`}
            description="Invitations expire after 7 days. Send again for an expired or corrected one."
            actions={<SendInvitationsButton batchId={selected.id} waiting={waiting} />}
          >
            {roster && !roster.ok ? (
              <LoadError message={roster.error.message} />
            ) : !roster || roster.data.length === 0 ? (
              <EmptyState>No students yet. Import a list above.</EmptyState>
            ) : (
              <>
                <p className="mb-3 text-sm text-muted-foreground tabular-nums">
                  {roster.data.length} {roster.data.length === 1 ? "student" : "students"}.{" "}
                  {roster.data.filter((student) => student.status === "accepted").length} joined.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Full name</TableHead>
                      <TableHead>Student number</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Invitation</TableHead>
                      <TableHead className="text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roster.data.map((student) => {
                      const label = resendLabels[student.status];
                      return (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">{student.fullName}</TableCell>
                          <TableCell className="font-mono tabular-nums">
                            {student.studentNumber}
                          </TableCell>
                          <TableCell className="break-all">{student.email}</TableCell>
                          <TableCell>
                            <InviteStatusBadge state={student.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            {label ? <ResendButton studentId={student.id} label={label} /> : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            )}
          </Section>
        </>
      )}

      {session.role === "admin" ? (
        <p className="text-xs text-muted-foreground">
          <RoleBadge role="neutral">Admin</RoleBadge> You can import into any course.
        </p>
      ) : null}
    </>
  );
}
