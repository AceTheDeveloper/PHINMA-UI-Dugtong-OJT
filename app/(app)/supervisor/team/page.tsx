import type { Metadata } from "next";
import { LoadError, PageHeader } from "@/components/admin/admin-parts";
import { RoleBadge } from "@/components/coordinator/status-badge";
import { InvitationActions, InviteColleagueSheet } from "@/components/supervisor/team-forms";
import { requireRole } from "@/lib/auth/server";
import { formatDate } from "@/lib/coordinator/metrics";
import { teamMessages, teamView } from "@/lib/supervisor/team";
import { getTeam } from "@/lib/supervisor/team-queries";

export const metadata: Metadata = {
  title: "Team · Dugtong OJT",
  robots: { index: false, follow: false },
};

const listClass =
  "divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-panel";

export default async function SupervisorTeamPage() {
  const session = await requireRole(["supervisor"]);
  const team = session.companyId ? await getTeam(session.companyId) : null;

  if (!team || !team.ok || !team.data) {
    const message = team && !team.ok ? team.error.message : teamMessages.noCompany;
    return (
      <>
        <PageHeader title="Team" description="The supervisors at your company." />
        <LoadError message={message} />
      </>
    );
  }

  const view = teamView(team.data, session, new Date());

  return (
    <>
      <PageHeader
        title="Team"
        description={view.description}
        actions={view.canManage ? <InviteColleagueSheet companyName={view.companyName} /> : undefined}
      />

      <section aria-labelledby="team-supervisors" className="grid gap-3">
        <h2 id="team-supervisors" className="font-heading text-lg font-bold text-ink">
          Supervisors
        </h2>
        <ul className={listClass}>
          {view.supervisors.map((supervisor) => (
            <li
              key={supervisor.userId}
              className="flex min-h-18 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-4 sm:px-6"
            >
              <span className="grid min-w-0 gap-0.5">
                <span className="text-[15px] font-semibold text-ink wrap-break-word">
                  {supervisor.name}
                  {supervisor.isYou ? <span className="font-normal text-copy-muted"> (you)</span> : null}
                </span>
                <span className="text-sm text-copy-muted break-all">{supervisor.email}</span>
              </span>
              <span className="flex flex-wrap gap-2">
                {supervisor.isOwner ? <RoleBadge role="info">Owner</RoleBadge> : null}
                {!supervisor.isActive ? <RoleBadge role="neutral">Inactive</RoleBadge> : null}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="team-invitations" className="grid gap-3">
        <h2 id="team-invitations" className="font-heading text-lg font-bold text-ink">
          Pending invitations
        </h2>
        {view.canManage && view.atLimit ? (
          <p className="rounded-lg border border-warning-border bg-warning-tint px-4 py-3 text-sm text-warning-text">
            {teamMessages.atLimit}
          </p>
        ) : null}
        {view.invitations.length === 0 ? (
          <p className="text-base text-copy-muted">
            No pending invitations.
            {view.canManage ? " Invite a colleague and they appear here until they sign up." : ""}
          </p>
        ) : (
          <ul className={listClass}>
            {view.invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex min-h-18 flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <span className="grid min-w-0 gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-semibold text-ink break-all">
                      {invitation.email}
                    </span>
                    {invitation.expired ? <RoleBadge role="warning">Expired</RoleBadge> : null}
                  </span>
                  <span className="text-sm text-copy-muted tabular-nums">
                    Sent {formatDate(invitation.sentAt)} ·{" "}
                    {invitation.expired ? "Expired" : "Expires"} {formatDate(invitation.expiresAt)}
                  </span>
                </span>
                {view.canManage ? (
                  <InvitationActions invitationId={invitation.id} email={invitation.email} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
