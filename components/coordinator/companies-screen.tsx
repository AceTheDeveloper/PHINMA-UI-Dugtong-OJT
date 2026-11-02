import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { focusStyle } from "@/components/brand-link";
import { RoleBadge } from "@/components/coordinator/status-badge";
import { DeploymentStatusBadge } from "@/components/supervisor/student-status";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/admin/format";
import { hoursText } from "@/lib/certification/template";
import type { CompaniesView, CompanyView } from "@/lib/coordinator/company-types";
import { cn } from "@/lib/utils";

// The partner companies and one company, read only, for the coordinator. They
// take the data and draw it, so the pages only fetch and check access.

export function CompaniesList({ view }: { view: CompaniesView }) {
  if (view.companies.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card px-6 py-12 text-center text-base text-copy-muted shadow-panel">
        No partner companies yet. The admin adds them.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-panel">
      {view.companies.map((company) => (
        <li key={company.id}>
          <Link
            href={`/coordinator/companies/${company.id}`}
            className={cn(
              "flex min-h-[88px] items-center gap-4 px-5 py-4 transition-colors hover:bg-surface sm:px-6",
              focusStyle,
            )}
          >
            <span className="grid min-w-0 flex-1 gap-1">
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-heading text-[17px] font-bold leading-tight text-ink wrap-break-word">
                  {company.name}
                </span>
                {company.status === "inactive" ? <RoleBadge role="neutral">Inactive</RoleBadge> : null}
              </span>
              <span className="text-[15px] text-copy-muted wrap-break-word">
                {company.ownerName ? `Contact: ${company.ownerName}` : "No contact person yet"}
                {" · "}
                <span className="tabular-nums">{company.supervisors}</span>{" "}
                {company.supervisors === 1 ? "supervisor" : "supervisors"}
                {" · "}
                <span className="tabular-nums">{company.openListings}</span> open{" "}
                {company.openListings === 1 ? "listing" : "listings"}
              </span>
            </span>
            <span className="grid justify-items-end gap-0.5 text-right max-sm:hidden">
              <span className="font-heading text-xl font-bold tabular-nums text-ink">
                {company.activeStudents}
              </span>
              <span className="text-sm text-muted-foreground">
                {company.activeStudents === 1 ? "active student" : "active students"}
              </span>
            </span>
            <span className="text-sm tabular-nums text-copy-muted max-sm:hidden">
              {hoursText(company.approvedHours)} h
            </span>
            <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-faint" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="grid gap-2">
      <h2 className="px-1 font-heading text-lg font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

const ruled = "divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-panel";

export function CompanyScreen({ view }: { view: CompanyView }) {
  const { company, supervisors, listings, students } = view;
  const active = students.filter((student) => student.status === "active").length;
  return (
    <>
      <Link
        href="/coordinator/companies"
        className={cn(buttonVariants({ variant: "ghost" }), "-ml-2 w-fit", focusStyle)}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to companies
      </Link>

      <section
        aria-labelledby="company-heading"
        className="grid gap-4 rounded-3xl border border-border bg-card p-6 shadow-panel sm:p-10"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid min-w-0 gap-1">
            <h1
              id="company-heading"
              className="font-heading text-[28px] font-bold leading-[1.1] tracking-[-0.03em] text-ink wrap-break-word sm:text-[36px]"
            >
              {company.name}
            </h1>
            {company.address ? (
              <p className="text-[15px] text-copy-muted wrap-break-word">{company.address}</p>
            ) : null}
          </div>
          <RoleBadge role={company.status === "active" ? "success" : "neutral"}>
            {company.status === "active" ? "Active" : "Inactive"}
          </RoleBadge>
        </div>
        <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
          <p className="font-heading text-[40px] font-bold leading-none tabular-nums tracking-[-0.03em] text-ink sm:text-[48px]">
            {active}
          </p>
          <p className="pb-1 text-[15px] text-copy-muted">
            {active === 1 ? "student is" : "students are"} on an active placement from{" "}
            {view.course.courseShort} {view.course.batchLabel}
          </p>
        </div>
      </section>

      <Section title="Students">
        {students.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card px-6 py-8 text-center text-[15px] text-copy-muted shadow-panel">
            No student of your course has been placed here yet.
          </p>
        ) : (
          <ul className={ruled}>
            {students.map((student) => (
              <li key={student.deploymentId}>
                <Link
                  href={`/coordinator/students/${student.studentId}`}
                  className={cn(
                    "flex min-h-[72px] items-center gap-4 px-5 py-4 transition-colors hover:bg-surface sm:px-6",
                    focusStyle,
                  )}
                >
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="font-heading text-[17px] font-bold leading-tight text-ink wrap-break-word">
                      {student.name}
                    </span>
                    <span className="font-mono text-sm tabular-nums text-copy-muted">
                      {student.studentNumber}
                    </span>
                  </span>
                  <DeploymentStatusBadge status={student.status} />
                  <span className="text-[15px] tabular-nums text-ink">
                    {hoursText(student.approvedHours)} / {hoursText(view.course.requiredHours)} h
                  </span>
                  <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-faint" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Supervisors">
        {supervisors.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card px-6 py-8 text-center text-[15px] text-copy-muted shadow-panel">
            No supervisor has been invited yet. The admin invites them.
          </p>
        ) : (
          <ul className={ruled}>
            {supervisors.map((supervisor) => (
              <li key={supervisor.email} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-4 sm:px-6">
                <span className="grid min-w-0 gap-0.5">
                  <span className="font-heading text-[17px] font-bold leading-tight text-ink wrap-break-word">
                    {supervisor.name}
                  </span>
                  <a
                    href={`mailto:${supervisor.email}`}
                    className={cn("text-[15px] text-copy-muted underline-offset-4 hover:underline wrap-break-word", focusStyle)}
                  >
                    {supervisor.email}
                  </a>
                </span>
                <span className="flex gap-2">
                  {supervisor.isOwner ? <RoleBadge role="teal">Contact person</RoleBadge> : null}
                  {supervisor.isActive ? null : <RoleBadge role="neutral">Inactive</RoleBadge>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Listings">
        {listings.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card px-6 py-8 text-center text-[15px] text-copy-muted shadow-panel">
            This company has no listing open to your course.
          </p>
        ) : (
          <ul className={ruled}>
            {listings.map((listing) => (
              <li key={listing.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-4 sm:px-6">
                <span className="grid gap-0.5">
                  <span className="font-heading text-[17px] font-bold leading-tight text-ink wrap-break-word">
                    {listing.title}
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    Posted {formatDate(listing.postedAt)}
                  </span>
                </span>
                <RoleBadge role={listing.status === "open" ? "success" : "neutral"}>
                  {listing.status === "open" ? "Open" : "Closed"}
                </RoleBadge>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
