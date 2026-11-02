import { RoleBadge, type StatusRole } from "@/components/coordinator/status-badge";
import type { ApplicationStatus } from "@/lib/applications/types";

// Colour roles for an application (AGENTS.md section 10).
const states: Record<ApplicationStatus, { label: string; role: StatusRole }> = {
  applied: { label: "Applied", role: "info" },
  accepted: { label: "Accepted", role: "success" },
  rejected: { label: "Rejected", role: "error" },
  withdrawn: { label: "Withdrawn", role: "neutral" },
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const { label, role } = states[status];
  return <RoleBadge role={role}>{label}</RoleBadge>;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeZone: "Asia/Manila",
  }).format(new Date(iso));
}
