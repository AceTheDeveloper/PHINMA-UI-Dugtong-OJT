import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { EmptyState, LoadError, PageHeader } from "@/components/admin/admin-parts";
import { focusStyle } from "@/components/brand-link";
import { RoleBadge } from "@/components/coordinator/status-badge";
import { DeploymentStatusBadge } from "@/components/supervisor/student-status";
import { HoursChain } from "@/components/ui/hours-chain";
import { requireRole } from "@/lib/auth/server";
import { getStudentsForCompany } from "@/lib/schedules/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Students · Dugtong OJT",
  robots: { index: false, follow: false },
};

function hoursText(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export default async function SupervisorStudentsPage() {
  const session = await requireRole(["supervisor"]);
  const students = session.companyId ? await getStudentsForCompany(session.companyId) : null;

  return (
    <>
      <PageHeader
        title="Students"
        description="Students deployed at your company. Open a student to set their work schedule."
      />
      {!students ? (
        <LoadError message="This account has no company. Contact the admin." />
      ) : !students.ok ? (
        <LoadError message={students.error.message} />
      ) : students.data.length === 0 ? (
        <EmptyState>
          No students yet. A student appears here once you accept their application.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-panel">
          {students.data.map((student) => (
            <li key={student.deploymentId}>
              <Link
                href={`/supervisor/students/${student.deploymentId}`}
                className={cn(
                  "flex min-h-[88px] items-center gap-4 px-5 py-4 transition-colors hover:bg-surface sm:px-6",
                  focusStyle,
                )}
              >
                <span className="grid min-w-0 flex-1 gap-1">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-heading text-[17px] font-bold leading-tight text-ink wrap-break-word">
                      {student.studentName}
                    </span>
                    <DeploymentStatusBadge status={student.status} />
                  </span>
                  <span className="text-[15px] text-copy-muted wrap-break-word">
                    <span className="font-mono tabular-nums">{student.studentNumber}</span>
                    {" · "}
                    {student.scheduleSummary ?? "No schedule yet"}
                  </span>
                </span>
                {student.status === "active" && !student.scheduleSummary ? (
                  <RoleBadge role="warning">Set schedule</RoleBadge>
                ) : null}
                <span className="grid justify-items-end gap-1 max-sm:hidden">
                  <HoursChain
                    size="sm"
                    approvedHours={student.approvedHours}
                    requiredHours={student.requiredHours}
                    className="justify-end"
                  />
                </span>
                <span className="font-mono text-sm tabular-nums text-copy-muted max-sm:hidden">
                  {hoursText(student.approvedHours)} / {hoursText(student.requiredHours)} h
                </span>
                <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
