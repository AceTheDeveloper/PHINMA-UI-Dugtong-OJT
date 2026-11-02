import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText, Send } from "lucide-react";
import { LoadError, PageHeader } from "@/components/admin/admin-parts";
import { RoleBadge } from "@/components/coordinator/status-badge";
import { focusStyle } from "@/components/brand-link";
import { Card, CardContent } from "@/components/ui/card";
import { getStudentSummary } from "@/lib/applications/queries";
import { requireRole } from "@/lib/auth/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Student home · Dugtong OJT",
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

export default async function StudentHomePage() {
  const session = await requireRole(["student"]);
  const summary = session.studentId ? await getStudentSummary(session.studentId) : null;

  return (
    <>
      <PageHeader
        title="Student home"
        description="Upload your resume, find a listing, and track your applications."
      />
      {!summary ? (
        <LoadError message="This account has no student record. Contact your coordinator." />
      ) : !summary.ok ? (
        <LoadError message={summary.error.message} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="inline-flex items-center gap-2 font-heading text-base font-bold text-ink">
                  <FileText aria-hidden="true" className="size-4" />
                  Resume
                </h2>
                <RoleBadge role={summary.data.hasResume ? "success" : "warning"}>
                  {summary.data.hasResume ? "Uploaded" : "Needed to apply"}
                </RoleBadge>
              </div>
              <p className="text-sm leading-[1.6] text-copy-muted">
                {summary.data.hasResume
                  ? "Your resume is ready. Replace it any time."
                  : "Upload your resume as a PDF before you apply to a listing."}
              </p>
              <CardLink href="/student/resume">
                {summary.data.hasResume ? "Replace resume" : "Upload resume"}
              </CardLink>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="inline-flex items-center gap-2 font-heading text-base font-bold text-ink">
                  <Send aria-hidden="true" className="size-4" />
                  Applications
                </h2>
                <RoleBadge role={summary.data.openApplications > 0 ? "info" : "neutral"}>
                  <span className="tabular-nums">{summary.data.openApplications}</span>
                  &nbsp;waiting
                </RoleBadge>
              </div>
              <p className="text-sm leading-[1.6] text-copy-muted">
                You have applied to{" "}
                <span className="tabular-nums">{summary.data.totalApplications}</span>{" "}
                {summary.data.totalApplications === 1 ? "listing" : "listings"}.
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <CardLink href="/student/listings">Browse listings</CardLink>
                <CardLink href="/student/applications">View applications</CardLink>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
