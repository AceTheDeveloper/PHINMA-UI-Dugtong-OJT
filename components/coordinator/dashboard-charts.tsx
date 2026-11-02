"use client";

import { ChartCard, hoursLabel } from "@/components/coordinator/charts/chart-parts";
import { Columns, HorizontalBars } from "@/components/coordinator/charts/bar-charts";
import { LineChart } from "@/components/coordinator/charts/line-chart";
import {
  companyHours,
  progressBuckets,
  stageCounts,
  weeklySeries,
} from "@/lib/coordinator/charts";
import type { Dashboard } from "@/lib/coordinator/types";

// The analysis section. A client component: it hands formatting functions to the
// charts, which cannot cross from a server component. It takes plain data only.
// Four charts built from the same rows as the table and
// the cards, so they always agree with them. One hue throughout (the primary
// colour); each chart says in words what it counts and has a table view.

const count = (value: number) => String(value);

export function DashboardCharts({ data }: { data: Dashboard }) {
  const { course, students, companies, weekly } = data;
  const stages = stageCounts(students);
  const progress = progressBuckets(students, course.requiredHours);
  const byCompany = companyHours(companies, students);
  const weeks = weeklySeries(weekly);

  const deployed = progress.reduce((sum, bar) => sum + bar.value, 0);
  const hoursThisPeriod = weeks.reduce((sum, week) => sum + week.value, 0);

  return (
    <section aria-label="Analysis" className="grid gap-4 lg:grid-cols-2">
      <ChartCard
        title="Where students are"
        note="Students at each stage, from no application to completed."
        table={{ head: ["Stage", "Students"], rows: stages.map((bar) => [bar.label, count(bar.value)]) }}
        empty={students.length === 0 ? "No students yet. Import the roster to see this chart." : undefined}
      >
        <HorizontalBars bars={stages} format={count} label="Students by stage" />
      </ChartCard>

      <ChartCard
        title="Progress toward the required hours"
        note={`Deployed students by how far they are toward ${course.requiredHours} hours.`}
        table={{ head: ["Progress", "Students"], rows: progress.map((bar) => [bar.label, count(bar.value)]) }}
        empty={deployed === 0 ? "No student is deployed yet." : undefined}
      >
        <Columns bars={progress} format={count} label="Students by progress" />
      </ChartCard>

      <ChartCard
        title="Approved hours by company"
        note="Total approved hours of this batch at each company."
        table={{ head: ["Company", "Approved hours"], rows: byCompany.map((bar) => [bar.label, hoursLabel(bar.value)]) }}
        empty={byCompany.length === 0 ? "No approved hours yet." : undefined}
      >
        <HorizontalBars bars={byCompany} format={hoursLabel} label="Approved hours by company" />
      </ChartCard>

      <ChartCard
        title="Approved hours per week"
        note="The last eight weeks, counted by the day of the entry. Only approved hours."
        table={{
          head: ["Week starting", "Approved hours"],
          rows: weeks.map((week) => [week.label, hoursLabel(week.value)]),
        }}
        empty={hoursThisPeriod === 0 ? "No hours were approved in the last eight weeks." : undefined}
      >
        <LineChart points={weeks} format={hoursLabel} label="Approved hours per week" />
      </ChartCard>
    </section>
  );
}
