import type { Metadata } from "next";
import { Download } from "lucide-react";
import { LoadError, PageHeader } from "@/components/admin/admin-parts";
import { focusStyle } from "@/components/brand-link";
import { RoleBadge } from "@/components/coordinator/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { getStudentCertification } from "@/lib/certification/queries";
import { hoursText, longDate, longDateOfInstant } from "@/lib/certification/template";
import { requireRole } from "@/lib/auth/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Certification · Dugtong OJT",
  robots: { index: false, follow: false },
};

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-semibold text-ink wrap-break-word">{children}</dd>
    </div>
  );
}

export default async function StudentCertificationPage() {
  const session = await requireRole(["student"]);
  const result = session.studentId ? await getStudentCertification(session.studentId) : null;

  return (
    <>
      <PageHeader
        title="Certification"
        description="Your certification is made when your supervisor submits your final evaluation."
      />
      {!result ? (
        <LoadError message="This account has no student record. Contact your coordinator." />
      ) : !result.ok ? (
        <LoadError message={result.error.message} />
      ) : !result.data ? (
        <p className="max-w-[62ch] rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-10 text-[15px] leading-[1.6] text-copy-muted">
          Nothing here yet. Once you reach the required hours, your supervisor evaluates you and your
          certification appears on this page, ready to download.
        </p>
      ) : (
        <section
          aria-label="Your certification"
          className="grid gap-6 rounded-3xl border border-border bg-card p-6 shadow-panel sm:p-10"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-[28px] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink">
              Certificate of completion
            </h2>
            <RoleBadge role="teal">Issued</RoleBadge>
          </div>
          <dl className="grid gap-4 text-[15px] sm:grid-cols-2">
            <Fact label="Company">{result.data.companyName}</Fact>
            <Fact label="Course">{result.data.courseName}</Fact>
            <Fact label="Approved hours">
              <span className="font-mono tabular-nums">{hoursText(result.data.approvedHours)} h</span>
            </Fact>
            <Fact label="Training period">
              <span className="tabular-nums">
                {longDate(result.data.startDate)} to {longDate(result.data.endDate)}
              </span>
            </Fact>
            <Fact label="Issued on">
              <span className="tabular-nums">{longDateOfInstant(result.data.issuedAt)}</span>
            </Fact>
          </dl>
          <div>
            <a
              href={`/certifications/${result.data.id}/pdf`}
              download
              className={cn(buttonVariants({ size: "lg" }), "h-11 px-6 text-[15px]", focusStyle)}
            >
              <Download aria-hidden="true" className="size-4" />
              Download certificate
            </a>
          </div>
        </section>
      )}
    </>
  );
}
