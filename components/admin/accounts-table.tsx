"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/admin/admin-parts";
import { NativeSelect, useAction } from "@/components/admin/form-parts";
import { RoleBadge } from "@/components/coordinator/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/admin/format";
import type { RegisteredUserSummary } from "@/lib/admin/queries";
import { toggleUserActive } from "@/app/(app)/admin/actions";

const roleLabels = {
  admin: "Admin",
  coordinator: "Coordinator",
  supervisor: "Supervisor",
  student: "Student",
} as const;

export function ToggleUserActiveButton({
  userId,
  name,
  isActive,
  isSelf,
}: {
  userId: string;
  name: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const action = useAction();

  if (isSelf) {
    return <span className="text-xs text-muted-foreground">(You)</span>;
  }

  function handleToggle() {
    if (isActive) {
      const ok = window.confirm(`Deactivate ${name}'s account? They will lose access immediately.`);
      if (!ok) return;
    }
    action.run(() => toggleUserActive({ userId, active: !isActive }));
  }

  return (
    <div className="grid justify-items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={isActive ? "text-error-text" : "text-success-text"}
        disabled={action.pending}
        onClick={handleToggle}
      >
        {action.pending
          ? isActive
            ? "Deactivating"
            : "Reactivating"
          : isActive
            ? "Deactivate"
            : "Reactivate"}
      </Button>
      {action.message ? <p className="max-w-48 text-xs text-error-text">{action.message}</p> : null}
    </div>
  );
}

export function AccountsTable({
  users,
  currentUserId,
}: {
  users: RegisteredUserSummary[];
  currentUserId: string;
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter === "active" && !u.isActive) return false;
      if (statusFilter === "deactivated" && u.isActive) return false;
      if (q) {
        const matchesName = u.fullName.toLowerCase().includes(q);
        const matchesEmail = u.email.toLowerCase().includes(q);
        const matchesAffiliation = u.affiliation?.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesAffiliation) return false;
      }
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            placeholder="Search by name, email, or affiliation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <NativeSelect
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-36"
            aria-label="Filter by role"
          >
            <option value="all">All roles</option>
            <option value="admin">Admin</option>
            <option value="coordinator">Coordinator</option>
            <option value="supervisor">Supervisor</option>
            <option value="student">Student</option>
          </NativeSelect>
          <NativeSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-36"
            aria-label="Filter by status"
          >
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="deactivated">Deactivated</option>
          </NativeSelect>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState>
          {users.length === 0
            ? "No accounts have registered yet."
            : "No accounts match the current filter."}
        </EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Affiliation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="font-medium text-ink">{user.fullName}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </TableCell>
                <TableCell>
                  <RoleBadge role="neutral">{roleLabels[user.role]}</RoleBadge>
                </TableCell>
                <TableCell>{user.affiliation ?? "None"}</TableCell>
                <TableCell>
                  {user.isActive ? (
                    <RoleBadge role="success">Active</RoleBadge>
                  ) : (
                    <RoleBadge role="error">Deactivated</RoleBadge>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatDateTime(user.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <ToggleUserActiveButton
                    userId={user.id}
                    name={user.fullName}
                    isActive={user.isActive}
                    isSelf={user.id === currentUserId}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
