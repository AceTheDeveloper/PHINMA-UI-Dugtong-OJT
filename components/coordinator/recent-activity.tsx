import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/coordinator/metrics";
import { mockActivity } from "@/lib/mock/coordinator";

export function RecentActivity() {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="font-heading text-base font-bold">
          Recent activity
        </CardTitle>
        <CardDescription>A preview of the audit log. Read-only.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3">
          {mockActivity.map((event) => (
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
