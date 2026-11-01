import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { LoadError, PageHeader } from "@/components/admin/admin-parts";
import { HistorySection } from "@/components/admin/history-section";
import { Card, CardContent } from "@/components/ui/card";
import { getOverview, type Overview } from "@/lib/admin/queries";
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

// The setup order from core flow step 1: academic structure, coordinator,
// partner companies, then each company's first supervisor.
function steps(overview: Overview): Step[] {
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
  const result = await getOverview();

  return (
    <>
      <PageHeader
        title="Overview"
        description="Set up the school's OJT in order. Each step links to the screen where you do it."
      />
      {!result.ok ? (
        <LoadError message={result.error.message} />
      ) : (
        <ol className="grid gap-3" aria-label="Setup steps">
          {steps(result.data).map((step, index) => (
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
      )}
      <HistorySection
        filter={{}}
        description="The latest changes across the whole system. Open the audit log for everything."
      />
    </>
  );
}
