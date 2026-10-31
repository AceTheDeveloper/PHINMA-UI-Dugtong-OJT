import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatDate,
  formatHours,
  openEntriesBefore,
  staleEntries,
} from "@/lib/coordinator/metrics";
import {
  mockCompanies,
  mockCourse,
  mockOpenEntries,
  mockPendingEntries,
  mockStudents,
} from "@/lib/mock/coordinator";
import { RoleBadge } from "./status-badge";

const studentsById = new Map(mockStudents.map((s) => [s.id, s]));
const companiesById = new Map(mockCompanies.map((c) => [c.id, c]));

function companyName(companyId: string | null) {
  return companyId ? (companiesById.get(companyId)?.name ?? "Unknown") : "No company";
}

function Group({
  title,
  description,
  empty,
  children,
  count,
}: {
  title: string;
  description: string;
  empty: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <h3 className="font-heading text-sm font-bold text-ink">{title}</h3>
      <p className="mb-3 text-xs text-muted-foreground">{description}</p>
      {count === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="grid gap-2">{children}</ul>
      )}
    </div>
  );
}

function Row({
  name,
  detail,
  badge,
}: {
  name: string;
  detail: string;
  badge: React.ReactNode;
}) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">{name}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      {badge}
    </li>
  );
}

export function AttentionPanel() {
  const stale = staleEntries(mockPendingEntries, mockCourse.staleThresholdDays);
  const ready = mockStudents.filter((s) => s.status === "ready");
  const open = openEntriesBefore(mockOpenEntries, mockCourse.asOf);

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="font-heading text-base font-bold">
          Needs attention
        </CardTitle>
        <CardDescription>
          Read-only. Supervisors act on entries and evaluations.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-3">
        <Group
          title="Stale pending entries"
          description={`Waiting more than ${mockCourse.staleThresholdDays} days for approval (placeholder threshold).`}
          empty="No stale entries."
          count={stale.length}
        >
          {stale.map((entry) => {
            const student = studentsById.get(entry.studentId);
            return (
              <Row
                key={entry.id}
                name={student?.name ?? "Unknown student"}
                detail={`${companyName(student?.companyId ?? null)} · entry of ${formatDate(entry.date)} · ${entry.daysWaiting} days`}
                badge={
                  <RoleBadge role="warning" solid>
                    Stale
                  </RoleBadge>
                }
              />
            );
          })}
        </Group>
        <Group
          title="Evaluation not submitted"
          description="Required hours reached, waiting for the supervisor."
          empty="No students waiting."
          count={ready.length}
        >
          {ready.map((student) => (
            <Row
              key={student.id}
              name={student.name}
              detail={`${companyName(student.companyId)} · ${formatHours(student.approvedHours)} of ${mockCourse.requiredHours} hours`}
              badge={<RoleBadge role="teal">Ready</RoleBadge>}
            />
          ))}
        </Group>
        <Group
          title="Entries never timed out"
          description="Timed in on an earlier day with no time out."
          empty="No open entries."
          count={open.length}
        >
          {open.map((entry) => {
            const student = studentsById.get(entry.studentId);
            return (
              <Row
                key={entry.id}
                name={student?.name ?? "Unknown student"}
                detail={`${companyName(student?.companyId ?? null)} · ${formatDate(entry.date)}`}
                badge={<RoleBadge role="info">Open</RoleBadge>}
              />
            );
          })}
        </Group>
      </CardContent>
    </Card>
  );
}
