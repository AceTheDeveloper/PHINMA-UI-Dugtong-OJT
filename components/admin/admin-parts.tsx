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
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-[-0.02em] text-ink">
          {title}
        </h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>
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

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border-strong bg-surface px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
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
