import type { Metadata } from "next";
import Link from "next/link";
import { Upload } from "lucide-react";
import { EmptyState, LoadError, PageHeader } from "@/components/admin/admin-parts";
import { DownloadButton } from "@/components/export/download-link";
import { AttentionPanel } from "@/components/coordinator/attention-panel";
import { CompaniesOverview } from "@/components/coordinator/companies-overview";
import { DashboardCharts } from "@/components/coordinator/dashboard-charts";
import { RecentActivity } from "@/components/coordinator/recent-activity";
import { RequiredHoursSheet } from "@/components/coordinator/required-hours-sheet";
import { StudentTable } from "@/components/coordinator/student-table";
import { SummaryCards } from "@/components/coordinator/summary-cards";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/server";
import { formatDate, summarize } from "@/lib/coordinator/metrics";
import { getDashboard } from "@/lib/coordinator/queries";

export const metadata: Metadata = {
  title: "Coordinator dashboard | Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function CoordinatorDashboardPage() {
  // Only the coordinator has a course of their own to look at.
  const session = await requireRole(["coordinator"]);
  const result = await getDashboard(session.courseIds);

  if (!result.ok) {
    return (
      <>
        <PageHeader title="Dashboard" description="How your students are doing on OJT." />
        <LoadError message={result.error.message} />
      </>
    );
  }
  if (!result.data) {
    return (
      <>
        <PageHeader title="Dashboard" description="How your students are doing on OJT." />
        <EmptyState>
          There is no OJT batch to show yet. Ask the admin to assign you to a course and create its
          batch for the school year.
        </EmptyState>
      </>
    );
  }

  const data = result.data;
  const { course } = data;
  const summary = summarize(data.students);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${course.courseShort} · ${course.departmentShort} · ${course.school}. Batch ${course.batchLabel}, ${course.requiredHours} required hours, as of ${formatDate(course.asOf)}.${data.otherCourses > 0 ? ` You have ${data.otherCourses} more ${data.otherCourses === 1 ? "course" : "courses"}; this page shows the first.` : ""}`}
        actions={
          <>
            <Button variant="outline" nativeButton={false} render={<Link href="/coordinator/roster" />}>
              <Upload aria-hidden="true" data-icon="inline-start" />
              Import roster
            </Button>
            <DownloadButton href="/coordinator/export">Export CSV</DownloadButton>
          </>
        }
      />

      <SummaryCards summary={summary} />
      <DashboardCharts data={data} />
      <AttentionPanel
        course={course}
        students={data.students}
        companies={data.companies}
        pending={data.pending}
        open={data.open}
      />
      <StudentTable
        students={data.students}
        companies={data.companies}
        requiredHours={course.requiredHours}
        action={
          <RequiredHoursSheet
            batchId={course.batchId}
            batchLabel={course.batchLabel}
            courseShort={course.courseShort}
            current={course.requiredHours}
            students={data.students}
          />
        }
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <CompaniesOverview companies={data.companies} students={data.students} />
        <RecentActivity activity={data.activity} />
      </div>
    </>
  );
}
