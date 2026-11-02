import type {
  DashboardCompany,
  DashboardStudent,
  StudentStatus,
  WeeklyHours,
} from "@/lib/coordinator/types";

// The numbers behind the dashboard's four charts. Pure: they take the same rows
// the table shows, so a chart and the table beside it can never disagree.

export type Bar = { label: string; value: number };

// The path a student takes, in the order they take it.
const stages: { status: StudentStatus; label: string }[] = [
  { status: "no-application", label: "No application" },
  { status: "applying", label: "Applying" },
  { status: "active", label: "Active" },
  { status: "ready", label: "Ready for evaluation" },
  { status: "completed", label: "Completed" },
  { status: "ended", label: "Ended" },
];

export function stageCounts(students: readonly DashboardStudent[]): Bar[] {
  return stages.map(({ status, label }) => ({
    label,
    value: students.filter((student) => student.status === status).length,
  }));
}

const buckets: { label: string; from: number; to: number }[] = [
  { label: "Under 25%", from: 0, to: 25 },
  { label: "25 to 49%", from: 25, to: 50 },
  { label: "50 to 74%", from: 50, to: 75 },
  { label: "75 to 99%", from: 75, to: 100 },
  { label: "100% or more", from: 100, to: Number.POSITIVE_INFINITY },
];

// How many deployed students sit in each quarter of the way to the required
// hours. A student who has finished counts as 100% or more. Students who are
// not deployed have no progress to show and are left out.
export function progressBuckets(
  students: readonly DashboardStudent[],
  requiredHours: number,
): Bar[] {
  const deployed = students.filter(
    (student) =>
      student.status === "active" || student.status === "ready" || student.status === "completed",
  );
  return buckets.map(({ label, from, to }) => ({
    label,
    value: deployed.filter((student) => {
      // The exact ratio, not the rounded one shown beside a progress bar: 299.9
      // of 300 hours is 99.97%, not "100% or more", and that student is not ready.
      const percent =
        student.status === "completed"
          ? 100
          : requiredHours > 0
            ? (student.approvedHours / requiredHours) * 100
            : 0;
      return percent >= from && percent < to;
    }).length,
  }));
}

// Approved hours per company, the largest first. A company with no hours is not
// a bar: it is in the companies table.
export function companyHours(
  companies: readonly DashboardCompany[],
  students: readonly DashboardStudent[],
): Bar[] {
  return companies
    .map((company) => ({
      label: company.name,
      value:
        Math.round(
          students
            .filter((student) => student.companyId === company.id)
            .reduce((sum, student) => sum + student.approvedHours, 0) * 100,
        ) / 100,
    }))
    .filter((bar) => bar.value > 0)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

// "Oct 5" for the Monday a week starts on, for the axis.
const weekLabel = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  month: "short",
  day: "numeric",
});

export function weeklySeries(weeks: readonly WeeklyHours[]): Bar[] {
  return weeks.map((week) => ({
    label: weekLabel.format(new Date(`${week.weekStart}T12:00:00+08:00`)),
    value: week.hours,
  }));
}
