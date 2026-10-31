import { Download, FileText, Upload } from "lucide-react";
import { AttentionPanel } from "@/components/coordinator/attention-panel";
import { CompaniesOverview } from "@/components/coordinator/companies-overview";
import { RecentActivity } from "@/components/coordinator/recent-activity";
import { StudentTable } from "@/components/coordinator/student-table";
import { SummaryCards } from "@/components/coordinator/summary-cards";
import { Button } from "@/components/ui/button";
import { formatDate, summarize } from "@/lib/coordinator/metrics";
import { mockCourse, mockStudents } from "@/lib/mock/coordinator";

export default function CoordinatorDashboardPage() {
  const summary = summarize(mockStudents);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-[-0.02em] text-ink">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mockCourse.courseShort} · {mockCourse.departmentShort} · {mockCourse.school}
          </p>
          <p className="text-sm text-muted-foreground tabular-nums">
            Required hours: {mockCourse.requiredHours} · As of {formatDate(mockCourse.asOf)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline">
            <Upload aria-hidden="true" data-icon="inline-start" />
            Import roster
          </Button>
          <Button type="button" variant="outline">
            <Download aria-hidden="true" data-icon="inline-start" />
            Export CSV
          </Button>
          <Button type="button" variant="outline">
            <FileText aria-hidden="true" data-icon="inline-start" />
            Export DTR PDF
          </Button>
        </div>
      </div>

      <SummaryCards summary={summary} />
      <AttentionPanel />
      <StudentTable />
      <div className="grid gap-6 xl:grid-cols-2">
        <CompaniesOverview />
        <RecentActivity />
      </div>
    </>
  );
}
