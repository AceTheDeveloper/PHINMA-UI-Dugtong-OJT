import { RoleBadge, type StatusRole } from "@/components/coordinator/status-badge";
import type { StudentRow } from "@/lib/schedules/types";

// Colour roles for a deployment (AGENTS.md section 10).
const states: Record<StudentRow["status"], { label: string; role: StatusRole }> = {
  active: { label: "Active", role: "success" },
  completed: { label: "Completed", role: "teal" },
  ended: { label: "Ended", role: "neutral" },
};

export function DeploymentStatusBadge({ status }: { status: StudentRow["status"] }) {
  const { label, role } = states[status];
  return <RoleBadge role={role}>{label}</RoleBadge>;
}
