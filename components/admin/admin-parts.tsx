import type { ReactNode } from "react";
import { RoleBadge, type StatusRole } from "@/components/coordinator/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { InvitationSummary } from "@/lib/admin/queries";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-heading text-[28px] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[32px]">
          {title}
        </h1>
        <p className="mt-2 max-w-[62ch] text-[15px] leading-[1.6] text-copy-muted">
          {description}
        </p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="font-heading text-base font-bold">
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {actions ? <div className="col-start-2 row-span-2 row-start-1 justify-self-end">{actions}</div> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// An empty screen points to the next step: say what is missing and, when there
// is something to do, give the action.
export function EmptyState({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="grid justify-items-center gap-4 rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-10 text-center">
      <p className="max-w-[46ch] text-[15px] leading-[1.6] text-copy-muted">{children}</p>
      {action}
    </div>
  );
}

export function LoadError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-error-border bg-error-tint px-4 py-3 text-sm text-error-text"
    >
      {message}
    </p>
  );
}

const invitationRoles: Record<InvitationSummary["status"], { label: string; role: StatusRole }> = {
  pending: { label: "Pending", role: "info" },
  used: { label: "Accepted", role: "success" },
  expired: { label: "Expired", role: "warning" },
  revoked: { label: "Revoked", role: "neutral" },
};

export function InvitationStatusBadge({ status }: { status: InvitationSummary["status"] }) {
  const { label, role } = invitationRoles[status];
  return <RoleBadge role={role}>{label}</RoleBadge>;
}

export function CompanyStatusBadge({ status }: { status: "active" | "inactive" }) {
  return status === "active" ? (
    <RoleBadge role="success">Active</RoleBadge>
  ) : (
    <RoleBadge role="neutral">Inactive</RoleBadge>
  );
}

const batchRoles = {
  planned: { label: "Planned", role: "info" },
  active: { label: "Active", role: "success" },
  closed: { label: "Closed", role: "neutral" },
} as const;

export function BatchStatusBadge({ status }: { status: keyof typeof batchRoles }) {
  const { label, role } = batchRoles[status];
  return <RoleBadge role={role}>{label}</RoleBadge>;
}

export function ListingStatusBadge({ status }: { status: "open" | "closed" }) {
  return status === "open" ? (
    <RoleBadge role="success">Open</RoleBadge>
  ) : (
    <RoleBadge role="neutral">Closed</RoleBadge>
  );
}

