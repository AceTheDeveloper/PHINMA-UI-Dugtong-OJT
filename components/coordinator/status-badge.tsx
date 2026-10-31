import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StudentStatus } from "@/lib/mock/coordinator";

export type StatusRole =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "teal"
  | "neutral";

// Tint is the default. Solid is for emphasis only (section 10).
const tintClasses: Record<StatusRole, string> = {
  info: "border-info-border bg-info-tint text-info-text",
  success: "border-success-border bg-success-tint text-success-text",
  warning: "border-warning-border bg-warning-tint text-warning-text",
  error: "border-error-border bg-error-tint text-error-text",
  teal: "border-teal-border bg-teal-tint text-teal-text",
  neutral: "border-neutral-border bg-neutral-tint text-neutral-text",
};

const solidClasses: Partial<Record<StatusRole, string>> = {
  warning: "border-warning bg-warning text-white",
};

export function RoleBadge({
  role,
  solid = false,
  className,
  children,
}: {
  role: StatusRole;
  solid?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        solid && solidClasses[role] ? solidClasses[role] : tintClasses[role],
        className,
      )}
    >
      {children}
    </Badge>
  );
}

export const studentStatuses: Record<
  StudentStatus,
  { label: string; role: StatusRole }
> = {
  active: { label: "Active", role: "success" },
  ready: { label: "Ready for evaluation", role: "teal" },
  completed: { label: "Completed", role: "teal" },
  applying: { label: "Applying", role: "info" },
  "no-application": { label: "No application", role: "neutral" },
  ended: { label: "Ended", role: "neutral" },
};

export function StudentStatusBadge({ status }: { status: StudentStatus }) {
  const { label, role } = studentStatuses[status];
  return <RoleBadge role={role}>{label}</RoleBadge>;
}
