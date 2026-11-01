import { RoleBadge, type StatusRole } from "@/components/coordinator/status-badge";
import type { InviteState } from "@/lib/roster/types";

const states: Record<InviteState, { label: string; role: StatusRole }> = {
  not_invited: { label: "Not invited", role: "neutral" },
  pending: { label: "Invitation pending", role: "info" },
  accepted: { label: "Joined", role: "success" },
  expired: { label: "Invitation expired", role: "warning" },
  revoked: { label: "Invitation revoked", role: "neutral" },
};

export function InviteStatusBadge({ state }: { state: InviteState }) {
  const { label, role } = states[state];
  return <RoleBadge role={role}>{label}</RoleBadge>;
}

// Which students still need an invitation sent.
export function needsInvitation(state: InviteState): boolean {
  return state === "not_invited" || state === "expired" || state === "revoked";
}
