import { RoleBadge, type StatusRole } from "@/components/coordinator/status-badge";
import type { LogStatus } from "@/lib/logs/types";

// Colour roles for a daily entry (AGENTS.md section 10).
const states: Record<LogStatus, { label: string; role: StatusRole }> = {
  open: { label: "Clocked in", role: "info" },
  pending: { label: "Pending", role: "warning" },
  approved: { label: "Approved", role: "success" },
  rejected: { label: "Rejected", role: "error" },
};

export function LogStatusBadge({ status }: { status: LogStatus }) {
  const { label, role } = states[status];
  return <RoleBadge role={role}>{label}</RoleBadge>;
}
