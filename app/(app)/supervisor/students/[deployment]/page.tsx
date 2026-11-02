import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LoadError } from "@/components/admin/admin-parts";
import { focusStyle } from "@/components/brand-link";
import { MissedDayForm } from "@/components/supervisor/missed-day-form";
import { ReviewEntryCard } from "@/components/supervisor/review-entry";
import { ScheduleForm } from "@/components/supervisor/schedule-form";
import { DeploymentStatusBadge } from "@/components/supervisor/student-status";
import { buttonVariants } from "@/components/ui/button";
import { HoursChain } from "@/components/ui/hours-chain";
import { formatPlainDate } from "@/lib/admin/format";
import { requireRole } from "@/lib/auth/server";
import { getEntriesForDeployment } from "@/lib/review/queries";
import {
  describeSchedule,
  manilaToday,
  scheduleInForce,
  upcomingSchedules,
} from "@/lib/schedules/logic";
import { getStudentDetail } from "@/lib/schedules/queries";
import type { WorkSchedule } from "@/lib/schedules/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Student · Dugtong OJT",
  robots: { index: false, follow: false },
};

function ScheduleLines({ schedule }: { schedule: WorkSchedule }) {
  return (
    <ul className="grid gap-1">
      {describeSchedule(schedule.days).map((line) => (
        <li key={`${line.days}-${line.times}`} className="flex flex-wrap gap-x-3 text-[15px]">
          <span className="min-w-28 font-semibold text-ink">{line.days}</span>
          <span className="font-mono tabular-nums text-copy-muted">{line.times}</span>
        </li>
      ))}
    </ul>
  );
}

function hoursText(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export default async function SupervisorStudentPage({
  params,
}: {
  params: Promise<{ deployment: string }>;
}) {
  const session = await requireRole(["supervisor"]);
  if (!session.companyId) return <LoadError message="This account has no company. Contact the admin." />;

  const { deployment } = await params;
  const result = await getStudentDetail(session.companyId, deployment);
  if (!result.ok) {
    if (result.error.code === "not_found") notFound();
    return <LoadError message={result.error.message} />;
  }
  const student = result.data;
  const entries = await getEntriesForDeployment(session.companyId, deployment);
  const today = manilaToday();
  const current = scheduleInForce(student.schedules, today);
  const upcoming = upcomingSchedules(student.schedules, today);
  const earlier = student.schedules.filter(
    (schedule) => schedule !== current && !upcoming.includes(schedule),
  );

  return (
    <>
      <Link
        href="/supervisor/students"
        className={cn(buttonVariants({ variant: "ghost" }), "-ml-2 w-fit", focusStyle)}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to students
      </Link>

      <section
        aria-labelledby="student-heading"
        className="grid gap-6 rounded-3xl border border-border bg-card p-6 shadow-panel sm:p-10"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid min-w-0 gap-1">
            <h1
              id="student-heading"
              className="font-heading text-[28px] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink wrap-break-word sm:text-[36px]"
            >
              {student.studentName}
            </h1>
            <p className="font-mono text-[15px] tabular-nums text-copy-muted">
              {student.studentNumber}
            </p>
          </div>
          <DeploymentStatusBadge status={student.status} />
        </div>

        <div className="grid gap-2">
          <h2 className="font-heading text-base font-bold text-ink">Work schedule</h2>
          {current ? (
            <>
              <ScheduleLines schedule={current} />
              <p className="text-sm text-muted-foreground">
                In force since {formatPlainDate(current.effectiveFrom)}.
              </p>
            </>
          ) : (
            <p className="text-[15px] leading-[1.6] text-copy-muted">
              No schedule is in force yet.{" "}
              {student.status === "active"
                ? "Set one below. The student cannot time in until a schedule starts."
                : null}
            </p>
          )}
        </div>

        <div className="grid gap-1">
          <p className="text-sm text-muted-foreground">Approved hours</p>
          <p className="font-mono text-[15px] tabular-nums text-ink">
            {hoursText(student.approvedHours)} of {hoursText(student.requiredHours)} h
          </p>
          <HoursChain
            size="sm"
            approvedHours={student.approvedHours}
            requiredHours={student.requiredHours}
          />
        </div>
      </section>

      {upcoming.length > 0 ? (
        <section
          aria-label="Upcoming schedules"
          className="grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-panel"
        >
          <h2 className="font-heading text-base font-bold text-ink">Starting later</h2>
          {upcoming.map((schedule) => (
            <div key={schedule.id} className="grid gap-1">
              <p className="text-sm font-semibold tabular-nums text-ink">
                From {formatPlainDate(schedule.effectiveFrom)}
              </p>
              <ScheduleLines schedule={schedule} />
            </div>
          ))}
        </section>
      ) : null}

      {student.status === "active" ? (
        <section
          aria-label="Set a schedule"
          className="grid gap-5 rounded-2xl border border-border bg-card p-6 shadow-panel sm:p-8"
        >
          <div className="grid gap-1">
            <h2 className="font-heading text-lg font-bold text-ink">Set a schedule</h2>
            <p className="max-w-[62ch] text-[15px] leading-[1.6] text-copy-muted">
              The new schedule applies from the date you choose. Setting one for a date that already
              has a schedule replaces it.
            </p>
          </div>
          <ScheduleForm
            deploymentId={student.deploymentId}
            today={today}
            startingDays={(current ?? upcoming[0])?.days ?? []}
          />
        </section>
      ) : (
        <p className="rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-8 text-center text-[15px] text-copy-muted">
          This deployment is no longer active, so its schedule cannot be changed.
        </p>
      )}

      <section aria-label="Daily log" className="grid gap-3">
        <h2 className="px-1 font-heading text-lg font-bold text-ink">Daily log</h2>
        {!entries.ok ? (
          <LoadError message={entries.error.message} />
        ) : entries.data.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-8 text-center text-[15px] text-copy-muted">
            No entries yet. They appear here after the student times in.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-panel">
            {entries.data.map((entry) => (
              <ReviewEntryCard key={entry.id} entry={entry} showStudent={false} />
            ))}
          </ul>
        )}
      </section>

      {student.status === "active" ? (
        <section
          aria-label="Add a missed day"
          className="grid gap-5 rounded-2xl border border-border bg-card p-6 shadow-panel sm:p-8"
        >
          <div className="grid gap-1">
            <h2 className="font-heading text-lg font-bold text-ink">Add a missed day</h2>
            <p className="max-w-[62ch] text-[15px] leading-[1.6] text-copy-muted">
              Use this when the student worked but never timed in, for example when their phone had no
              signal. The day goes back to the student to write the journal, then to you to approve.
            </p>
          </div>
          <MissedDayForm
            deploymentId={student.deploymentId}
            today={today}
            defaultStart={(current ?? upcoming[0])?.days[0]?.start ?? "08:00"}
            defaultEnd={(current ?? upcoming[0])?.days[0]?.end ?? "17:00"}
          />
        </section>
      ) : null}

      {earlier.length > 0 ? (
        <section
          aria-label="Earlier schedules"
          className="grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-panel"
        >
          <h2 className="font-heading text-base font-bold text-ink">Earlier schedules</h2>
          {earlier.map((schedule) => (
            <div key={schedule.id} className="grid gap-1">
              <p className="text-sm font-semibold tabular-nums text-ink">
                From {formatPlainDate(schedule.effectiveFrom)}
              </p>
              <ScheduleLines schedule={schedule} />
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}
