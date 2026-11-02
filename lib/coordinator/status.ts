import type { StudentStatus } from "@/lib/coordinator/types";

// A student's stage is computed from their deployments and applications, never
// stored. The order below decides when facts disagree: a submitted evaluation
// wins, then a running deployment, then an open application, then an ended
// deployment.

export type StatusInput = {
  deployments: readonly { status: "active" | "completed" | "ended" }[];
  // Applications still waiting for a supervisor's decision.
  openApplications: number;
  approvedHours: number;
  requiredHours: number;
};

export function studentStatus(input: StatusInput): StudentStatus {
  if (input.deployments.some((deployment) => deployment.status === "completed")) {
    return "completed";
  }
  if (input.deployments.some((deployment) => deployment.status === "active")) {
    return input.requiredHours > 0 && input.approvedHours >= input.requiredHours
      ? "ready"
      : "active";
  }
  if (input.openApplications > 0) return "applying";
  if (input.deployments.some((deployment) => deployment.status === "ended")) return "ended";
  return "no-application";
}

// The words for each stage, in one place for the table, the charts, and the CSV.
export const statusLabels: Record<StudentStatus, string> = {
  "no-application": "No application",
  applying: "Applying",
  active: "Active",
  ready: "Ready for evaluation",
  completed: "Completed",
  ended: "Ended",
};
