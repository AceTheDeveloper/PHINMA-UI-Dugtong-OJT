import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Summary } from "@/lib/coordinator/metrics";

export function SummaryCards({ summary }: { summary: Summary }) {
  const cards = [
    { label: "Total students", value: summary.total, note: "In the course" },
    { label: "Active deployments", value: summary.active, note: "Logging hours now" },
    { label: "Not yet deployed", value: summary.notDeployed, note: "Applying or no application" },
    { label: "Ready for evaluation", value: summary.ready, note: "Required hours reached" },
    {
      label: "Evaluations submitted",
      value: summary.evaluated,
      note: `${summary.evaluated} ${summary.evaluated === 1 ? "certification" : "certifications"} generated`,
    },
  ];

  return (
    <section
      aria-label="Summary"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
    >
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader>
            <CardTitle className="text-[15px] font-semibold text-copy-muted">
              {card.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-4xl font-semibold leading-none tracking-[-0.04em] tabular-nums text-ink">
              {card.value}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{card.note}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
