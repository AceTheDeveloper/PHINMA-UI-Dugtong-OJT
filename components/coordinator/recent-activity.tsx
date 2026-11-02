import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/coordinator/metrics";
import type { Activity } from "@/lib/coordinator/types";

export function RecentActivity({ activity }: { activity: Activity[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="font-heading text-base font-bold">
          Recent activity
        </CardTitle>
        <CardDescription>Evaluations, certifications, deployments, and required hours in your course. Read-only.</CardDescription>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing has happened yet.</p>
        ) : null}
        <ul className="grid gap-3">
          {activity.map((event) => (
            <li key={event.id} className="flex items-start gap-3 text-sm">
              <span
                aria-hidden="true"
                className="mt-1.5 size-2 shrink-0 rounded-full bg-primary-track"
              />
              <div className="min-w-0">
                <p className="text-ink">{event.text}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatDate(event.at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
