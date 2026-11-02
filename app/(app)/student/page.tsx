import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileText, Send } from "lucide-react";
import { LoadError } from "@/components/admin/admin-parts";
import { focusStyle } from "@/components/brand-link";
import { RoleBadge } from "@/components/coordinator/status-badge";
import { TodayCard } from "@/components/student/today-card";
import { HoursChain } from "@/components/ui/hours-chain";
import { getStudentSummary } from "@/lib/applications/queries";
import { requireRole } from "@/lib/auth/server";
import { getTodayForStudent } from "@/lib/logs/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Student home · Dugtong OJT",
  robots: { index: false, follow: false },
};

// Greeting by the hour in Manila, where the students are.
function greeting(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Manila" }).format(now),
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function firstName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[0] ?? fullName;
}

function Row({
  href,
  icon,
  title,
  note,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  note: string;
  badge: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-[72px] items-center gap-4 px-5 py-4 transition-colors hover:bg-surface sm:px-6",
        focusStyle,
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-tint text-primary"
      >
        {icon}
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="font-heading text-[17px] font-bold leading-tight text-ink">{title}</span>
        <span className="text-[15px] leading-snug text-copy-muted">{note}</span>
      </span>
      {badge}
      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-faint" />
    </Link>
  );
}

export default async function StudentHomePage() {
  const session = await requireRole(["student"]);
  const [result, today] = session.studentId
    ? await Promise.all([
        getStudentSummary(session.studentId),
        getTodayForStudent(session.studentId),
      ])
    : [null, null];

  if (!result) {
    return <LoadError message="This account has no student record. Contact your coordinator." />;
  }
  if (!result.ok) return <LoadError message={result.error.message} />;
  const summary = result.data;
  const hours = Number.isInteger(summary.approvedHours)
    ? String(summary.approvedHours)
    : summary.approvedHours.toFixed(1);

  return (
    <>
      <section
        aria-labelledby="home-heading"
        className="overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-panel sm:p-10"
      >
        <h1
          id="home-heading"
          className="font-heading text-[28px] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[40px]"
        >
          {greeting(new Date())}, {firstName(summary.fullName)}
        </h1>
        <p className="mt-2 max-w-[56ch] text-[15px] leading-[1.6] text-copy-muted sm:text-base">
          {summary.placement
            ? `You are deployed at ${summary.placement}.`
            : "Your hours start counting once a supervisor accepts you. Apply to a listing to begin."}
        </p>

        <div className="mt-8 flex flex-wrap items-end gap-x-3 gap-y-1">
          <p className="font-mono text-[56px] font-semibold leading-none tabular-nums tracking-[-0.04em] text-ink sm:text-[72px]">
            {hours}
          </p>
          <p className="pb-1.5 text-[15px] text-copy-muted sm:pb-2.5 sm:text-base">
            of{" "}
            <span className="font-mono font-semibold tabular-nums text-ink">
              {summary.requiredHours}
            </span>{" "}
            approved hours
          </p>
        </div>
        <HoursChain
          approvedHours={summary.approvedHours}
          requiredHours={summary.requiredHours}
          className="mt-5"
        />
      </section>

      {today?.ok ? <TodayCard view={today.data.view} /> : null}

      <section
        aria-label="Next steps"
        className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-panel"
      >
        <Row
          href="/student/resume"
          icon={<FileText className="size-5" />}
          title="Resume"
          note={
            summary.hasResume
              ? "Ready for supervisors to read. Replace it any time."
              : "Upload a PDF before you apply to a listing."
          }
          badge={
            <RoleBadge role={summary.hasResume ? "success" : "warning"}>
              {summary.hasResume ? "Uploaded" : "Needed"}
            </RoleBadge>
          }
        />
        <Row
          href={summary.totalApplications > 0 ? "/student/applications" : "/student/listings"}
          icon={<Send className="size-5" />}
          title={summary.totalApplications > 0 ? "Applications" : "Find a listing"}
          note={
            summary.totalApplications > 0
              ? `You have applied to ${summary.totalApplications} ${
                  summary.totalApplications === 1 ? "listing" : "listings"
                }.`
              : "Open positions at partner companies for your course."
          }
          badge={
            summary.openApplications > 0 ? (
              <RoleBadge role="info">
                <span className="tabular-nums">{summary.openApplications}</span>&nbsp;waiting
              </RoleBadge>
            ) : null
          }
        />
      </section>
    </>
  );
}
