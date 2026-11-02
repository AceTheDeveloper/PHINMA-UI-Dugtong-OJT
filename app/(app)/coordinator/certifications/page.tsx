import type { Metadata } from "next";
import { Download } from "lucide-react";
import { EmptyState, LoadError, PageHeader } from "@/components/admin/admin-parts";
import { focusStyle } from "@/components/brand-link";
import { RoleBadge } from "@/components/coordinator/status-badge";
import { SignatoryForm } from "@/components/coordinator/signatory-form";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/server";
import { getCertificationsForCourses, getTemplatesForCourses } from "@/lib/certification/queries";
import { hoursText, longDate, longDateOfInstant } from "@/lib/certification/template";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Certifications | Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function CoordinatorCertificationsPage() {
  // The signatories are the coordinator's to name, so the admin does not use this page.
  const session = await requireRole(["coordinator"]);
  const [templates, certifications] = await Promise.all([
    getTemplatesForCourses(session.courseIds),
    getCertificationsForCourses(session.courseIds),
  ]);

  return (
    <>
      <PageHeader
        title="Certifications"
        description="A certification is made when a supervisor submits a student's evaluation. Download it here or let the student download their own."
      />

      {!templates.ok ? (
        <LoadError message={templates.error.message} />
      ) : (
        templates.data.map((template) => (
          <section
            key={template.courseId}
            aria-label={`Signatories, ${template.courseLabel}`}
            className="grid gap-5 rounded-2xl border border-border bg-card p-6 shadow-panel sm:p-8"
          >
            <div className="grid gap-1">
              <h2 className="font-heading text-lg font-bold text-ink">Signatories</h2>
              <p className="text-sm text-copy-muted">{template.courseLabel}</p>
            </div>
            <SignatoryForm template={template} />
          </section>
        ))
      )}

      <section aria-label="Issued certifications" className="grid gap-2">
        <h2 className="px-1 font-heading text-lg font-bold text-ink">Issued</h2>
        {!certifications.ok ? (
          <LoadError message={certifications.error.message} />
        ) : certifications.data.length === 0 ? (
          <EmptyState>
            No certifications yet. They appear here after a supervisor submits an evaluation.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-panel">
            {certifications.data.map((cert) => (
              <li key={cert.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 sm:px-6">
                <div className="grid min-w-0 flex-1 gap-1">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-heading text-[17px] font-bold leading-tight text-ink wrap-break-word">
                      {cert.studentName}
                    </span>
                    <RoleBadge role={cert.status === "issued" ? "teal" : "neutral"}>
                      {cert.status === "issued" ? "Issued" : "Voided"}
                    </RoleBadge>
                  </p>
                  <p className="text-[15px] text-copy-muted wrap-break-word">
                    <span className="font-mono tabular-nums">{cert.studentNumber}</span>
                    {" · "}
                    {cert.companyName}
                    {" · "}
                    <span className="tabular-nums">{hoursText(cert.approvedHours)} h</span>
                  </p>
                  <p className="text-sm tabular-nums text-muted-foreground">
                    {longDate(cert.startDate)} to {longDate(cert.endDate)}. Issued on{" "}
                    {longDateOfInstant(cert.issuedAt)}.
                  </p>
                </div>
                {cert.status === "issued" ? (
                  <a
                    href={`/certifications/${cert.id}/pdf`}
                    download
                    className={cn(buttonVariants({ variant: "outline" }), "h-11 px-5", focusStyle)}
                  >
                    <Download aria-hidden="true" className="size-4" />
                    Download
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
