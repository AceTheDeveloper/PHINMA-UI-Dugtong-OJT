import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Briefcase, Users } from "lucide-react";
import { LoadError, PageHeader } from "@/components/admin/admin-parts";
import { focusStyle } from "@/components/brand-link";
import { RoleBadge } from "@/components/coordinator/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { getSupervisorSummary } from "@/lib/applicants/queries";
import { requireRole } from "@/lib/auth/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Supervisor home · Dugtong OJT",
  robots: { index: false, follow: false },
};

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline",
        focusStyle,
      )}
    >
      {children}
      <ArrowRight aria-hidden="true" className="size-4" />
    </Link>
  );
}

export default async function SupervisorHomePage() {
  const session = await requireRole(["supervisor"]);
  const summary = session.companyId ? await getSupervisorSummary(session.companyId) : null;

  return (
    <>
      <PageHeader
        title="Supervisor home"
        description="Post listings for your company and decide on applicants."
      />
      {!summary ? (
        <LoadError message="This account has no company. Contact the admin." />
      ) : !summary.ok ? (
        <LoadError message={summary.error.message} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="inline-flex items-center gap-2 font-heading text-base font-bold text-ink">
                  <Briefcase aria-hidden="true" className="size-4" />
                  Listings
                </h2>
                <RoleBadge role={summary.data.openListings > 0 ? "success" : "neutral"}>
                  <span className="tabular-nums">{summary.data.openListings}</span>
                  &nbsp;open
                </RoleBadge>
              </div>
              <p className="text-sm leading-[1.6] text-copy-muted">
                Students see your open listings when they browse. Close one when it is full.
              </p>
              <CardLink href="/supervisor/listings">Manage listings</CardLink>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="inline-flex items-center gap-2 font-heading text-base font-bold text-ink">
                  <Users aria-hidden="true" className="size-4" />
                  Applicants
                </h2>
                <RoleBadge role={summary.data.waitingApplicants > 0 ? "warning" : "neutral"}>
                  <span className="tabular-nums">{summary.data.waitingApplicants}</span>
                  &nbsp;waiting
                </RoleBadge>
              </div>
              <p className="text-sm leading-[1.6] text-copy-muted">
                <span className="tabular-nums">{summary.data.activeStudents}</span>{" "}
                {summary.data.activeStudents === 1 ? "student is" : "students are"} deployed
                with your company.
              </p>
              <CardLink href="/supervisor/applicants">Review applicants</CardLink>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
