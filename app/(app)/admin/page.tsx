import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Download } from "lucide-react";
import { LoadError, PageHeader } from "@/components/admin/admin-parts";
import { HistorySection } from "@/components/admin/history-section";
import { focusStyle } from "@/components/brand-link";
import { RoleBadge } from "@/components/coordinator/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAdminOverviewMetrics, type AdminOverviewMetrics } from "@/lib/admin/overview-queries";
import { requireRole } from "@/lib/auth/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Admin overview | Dugtong OJT",
  robots: { index: false, follow: false },
};

type Step = {
  title: string;
  detail: string;
  href: string;
  done: boolean;
};

function steps(overview: AdminOverviewMetrics): Step[] {
  return [
    {
      title: "Add a department and a course",
      detail:
        overview.courses > 0
          ? `${overview.departments} ${overview.departments === 1 ? "department" : "departments"} and ${overview.courses} ${overview.courses === 1 ? "course" : "courses"} added.`
          : "Add the department and the course first, for example CITE and BSIT.",
      href: "/admin/academics",
      done: overview.courses > 0,
    },
    {
      title: "Add an OJT batch with the required hours",
      detail:
        overview.batches > 0
          ? `${overview.batches} ${overview.batches === 1 ? "batch" : "batches"} added.`
          : "A batch sets the school year and the hours students must complete.",
      href: "/admin/academics",
      done: overview.batches > 0,
    },
    {
      title: "Invite the coordinator",
      detail:
        overview.coordinators > 0
          ? `${overview.coordinators} ${overview.coordinators === 1 ? "coordinator has" : "coordinators have"} joined.`
          : overview.pendingCoordinatorInvitations > 0
            ? "Invitation sent. Waiting for the coordinator to accept."
            : "The coordinator needs a course to be assigned to.",
      href: "/admin/people",
      done: overview.coordinators > 0,
    },
    {
      title: "Add the partner companies",
      detail:
        overview.companies > 0
          ? `${overview.companies} ${overview.companies === 1 ? "company" : "companies"} added.`
          : "Add the companies the school provided.",
      href: "/admin/companies",
      done: overview.companies > 0,
    },
    {
      title: "Invite a supervisor for each company",
      detail:
        overview.companies === 0
          ? "Add a company first."
          : `${overview.companiesWithOwner} of ${overview.companies} companies have an owner.${
              overview.pendingSupervisorInvitations > 0
                ? ` ${overview.pendingSupervisorInvitations} ${overview.pendingSupervisorInvitations === 1 ? "invitation is" : "invitations are"} waiting.`
                : ""
            }`,
      href: "/admin/companies",
      done: overview.companies > 0 && overview.companiesWithOwner === overview.companies,
    },
  ];
}

export default async function AdminOverviewPage() {
  await requireRole(["admin"]);
  const result = await getAdminOverviewMetrics();

  if (!result.ok) {
    return (
      <>
        <PageHeader
          title="Overview"
          description="System-wide status of students, companies, and daily OJT operations."
        />
        <LoadError message={result.error.message} />
      </>
    );
  }

  const metrics = result.data;
  const setupSteps = steps(metrics);
  const allSetupDone = setupSteps.every((s) => s.done);

  return (
    <>
      <PageHeader
        title="Overview"
        description="System-wide status of students, companies, and daily OJT operations."
        actions={
          <a
            href="/admin/export"
            download
            className={cn(buttonVariants({ variant: "outline" }), "h-11 px-5", focusStyle)}
          >
            <Download aria-hidden="true" className="size-4" />
            Export progress CSV
          </a>
        }
      />

      {/* Signature Focal Point Panel: Active OJT Deployments */}
      <section
        aria-label="OJT deployment overview"
        className="grid gap-6 rounded-2xl border border-border bg-card p-6 shadow-panel sm:p-8 lg:grid-cols-12 lg:items-center"
      >
        <div className="grid gap-2 lg:col-span-7">
          <p className="text-sm font-semibold tracking-wide text-copy-muted">
            STUDENTS ON OJT
          </p>
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-heading text-5xl font-extrabold tabular-nums tracking-tight text-ink sm:text-6xl">
              {metrics.activeDeployments}
            </span>
            <span className="text-base text-copy-muted sm:text-lg">
              active deployments out of{" "}
              <strong className="font-semibold text-ink tabular-nums">{metrics.totalStudents}</strong>{" "}
              enrolled students
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Across {metrics.departments} departments and {metrics.courses} active courses.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-3 lg:col-span-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div className="grid gap-1">
            <span className="text-xs font-semibold text-copy-muted">Ready / done</span>
            <span className="font-mono text-2xl font-bold tabular-nums text-ink">
              {metrics.completedDeployments}
            </span>
            <span className="text-xs text-muted-foreground">Completed hours</span>
          </div>
          <div className="grid gap-1">
            <span className="text-xs font-semibold text-copy-muted">Applying</span>
            <span className="font-mono text-2xl font-bold tabular-nums text-ink">
              {metrics.applyingStudents}
            </span>
            <span className="text-xs text-muted-foreground">Seeking placement</span>
          </div>
          <div className="col-span-2 grid gap-1 sm:col-span-1">
            <span className="text-xs font-semibold text-copy-muted">Total approved</span>
            <span className="font-mono text-2xl font-bold tabular-nums text-ink">
              {metrics.totalApprovedHours.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">Hours rendered</span>
          </div>
        </div>
      </section>

      {/* Ruled Rows: Daily Operations & Approvals */}
      <section aria-label="Daily operations and approvals" className="grid gap-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-heading text-lg font-bold text-ink">Daily operations & approvals</h2>
          <Link
            href="/admin/logs"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Open daily logs
          </Link>
        </div>

        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-panel">
          <li className="flex items-center justify-between gap-4 p-5 sm:px-6">
            <div className="grid min-w-0 flex-1 gap-1">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-heading text-[17px] font-bold text-ink">
                  Pending supervisor approvals
                </span>
                <RoleBadge role="warning">{metrics.pendingEntries} waiting</RoleBadge>
              </div>
              <p className="text-sm text-copy-muted">
                Daily logs submitted by students waiting for company supervisor review.
              </p>
            </div>
            <Link
              href="/admin/logs?status=pending"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0", focusStyle)}
            >
              View pending
            </Link>
          </li>

          <li className="flex items-center justify-between gap-4 p-5 sm:px-6">
            <div className="grid min-w-0 flex-1 gap-1">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-heading text-[17px] font-bold text-ink">
                  Stale pending entries
                </span>
                <RoleBadge role={metrics.stalePendingEntries > 0 ? "warning" : "neutral"}>
                  {metrics.stalePendingEntries} stale
                </RoleBadge>
              </div>
              <p className="text-sm text-copy-muted">
                Entries that have waited longer than 3 days without supervisor action.
              </p>
            </div>
            <Link
              href="/admin/logs?status=stale"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0", focusStyle)}
            >
              View stale
            </Link>
          </li>

          <li className="flex items-center justify-between gap-4 p-5 sm:px-6">
            <div className="grid min-w-0 flex-1 gap-1">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-heading text-[17px] font-bold text-ink">
                  Clocked in today
                </span>
                <RoleBadge role="info">{metrics.openEntries} active</RoleBadge>
              </div>
              <p className="text-sm text-copy-muted">
                Students currently timed in with an open entry for today.
              </p>
            </div>
            <Link
              href="/admin/logs?status=no-time-out"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0", focusStyle)}
            >
              View open
            </Link>
          </li>

          <li className="flex items-center justify-between gap-4 p-5 sm:px-6">
            <div className="grid min-w-0 flex-1 gap-1">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-heading text-[17px] font-bold text-ink">
                  Partner companies & listings
                </span>
                <RoleBadge role="teal">
                  {metrics.activeCompanies} companies · {metrics.activeListings} listings
                </RoleBadge>
              </div>
              <p className="text-sm text-copy-muted">
                Active partner organizations and open slots for student applications.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/admin/companies"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0", focusStyle)}
              >
                Companies
              </Link>
              <Link
                href="/admin/listings"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0", focusStyle)}
              >
                Listings
              </Link>
            </div>
          </li>
        </ul>
      </section>

      {/* Setup Steps (Visible when setting up, or collapsible status) */}
      <section aria-label="Setup steps" className="grid gap-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-heading text-lg font-bold text-ink">
            {allSetupDone ? "Setup status" : "Setup steps"}
          </h2>
          <span className="text-xs font-semibold uppercase tracking-wider text-copy-muted">
            {setupSteps.filter((s) => s.done).length} OF {setupSteps.length} COMPLETE
          </span>
        </div>

        <ol className="grid gap-3">
          {setupSteps.map((step, index) => (
            <li key={step.title}>
              <Link
                href={step.href}
                className="group block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Card className="transition-colors group-hover:bg-surface">
                  <CardContent className="flex items-center gap-4">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold tabular-nums",
                        step.done
                          ? "border-success-border bg-success-tint text-success-text"
                          : "border-border-strong bg-surface text-copy-muted",
                      )}
                    >
                      {step.done ? <Check className="size-4" /> : index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{step.title}</p>
                      <p className="text-sm text-muted-foreground">{step.detail}</p>
                    </div>
                    <span className="sr-only">{step.done ? "Done" : "Not done"}</span>
                    <ArrowRight
                      aria-hidden="true"
                      className="size-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5"
                    />
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <HistorySection
        filter={{}}
        description="The latest changes across the whole system. Open the audit log for everything."
      />
    </>
  );
}
