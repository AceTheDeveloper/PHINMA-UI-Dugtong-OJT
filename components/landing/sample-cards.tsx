import type { ReactNode } from "react";
import { Award } from "lucide-react";
import { cn } from "@/lib/utils";

// Illustrative product cards with fictional data. They are decoration, so the
// pages that show them mark the group aria-hidden and label it "Sample data".

type Tone = "info" | "success" | "warning" | "teal";

const pillTones: Record<Tone, string> = {
  info: "border-info-border bg-info-tint text-info-text",
  success: "border-success-border bg-success-tint text-success-text",
  warning: "border-warning-border bg-warning-tint text-warning-text",
  teal: "border-teal-border bg-teal-tint text-teal-text",
};

function Pill({
  tone,
  dot,
  children,
}: {
  tone: Tone;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold",
        pillTones[tone],
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-info" />}
      {children}
    </span>
  );
}

function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-[18px] shadow-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-[0.06em] text-faint">
      {children}
    </span>
  );
}

export function TodayCard({
  className,
  showJournal = true,
}: {
  className?: string;
  showJournal?: boolean;
}) {
  return (
    <Card className={className}>
      <div className="mb-3.5 flex items-center justify-between">
        <Eyebrow>Today</Eyebrow>
        <Pill tone="info" dot>
          Clocked in
        </Pill>
      </div>
      <div className="flex items-baseline gap-2.5">
        <span className="font-mono text-[30px] font-semibold tracking-[-0.04em] tabular-nums">
          08:02
        </span>
        <span className="text-[13px] text-faint">AM, time in</span>
      </div>
      {showJournal && (
        <>
          <div className="mt-3.5 rounded-[10px] bg-surface px-3 py-2.5 text-[13px] leading-normal text-copy-muted">
            Fixed the login redirect and reviewed two pull requests.
          </div>
          <div className="mt-3.5 flex h-[38px] items-center justify-center rounded-[10px] bg-primary text-sm font-semibold text-primary-foreground">
            Time out
          </div>
        </>
      )}
    </Card>
  );
}

export function HoursCard({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <div className="mb-3.5 flex items-center justify-between">
        <Eyebrow>Approved hours</Eyebrow>
        <Pill tone="success">On track</Pill>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-[34px] font-semibold tracking-[-0.04em] tabular-nums">
          212
        </span>
        <span className="font-mono text-[15px] text-faint tabular-nums">
          / 300 h
        </span>
      </div>
      <div className="mt-3.5 h-2 overflow-hidden rounded-full bg-primary-track">
        <div className="h-full w-[71%] rounded-full bg-primary" />
      </div>
      <p className="mt-2.5 text-[13px] text-copy-muted">88 hours to go</p>
    </Card>
  );
}

export function PendingCard({ className }: { className?: string }) {
  const rows = [
    { name: "Ana S.", hours: "8.0 h" },
    { name: "Ben M.", hours: "7.5 h" },
    { name: "Cara D.", hours: "8.0 h" },
  ];
  return (
    <Card className={className}>
      <div className="mb-3 flex items-center justify-between">
        <Eyebrow>Supervisor</Eyebrow>
        <Pill tone="warning">3 pending</Pill>
      </div>
      <div className="grid gap-2.5">
        {rows.map((row) => (
          <div
            key={row.name}
            className="flex items-center justify-between text-sm"
          >
            <span>{row.name}</span>
            <span className="font-mono text-copy-muted tabular-nums">
              {row.hours}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3.5 flex h-[38px] items-center justify-center rounded-[10px] border border-border-strong bg-card text-sm font-semibold">
        Approve all
      </div>
    </Card>
  );
}

export function CertificationCard({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <Card className={className}>
      <div className="flex items-center gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-tint text-teal-text">
          <Award className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-heading text-base font-bold">
            {compact ? "Certification ready" : "Certification"}
          </p>
          <p className="text-[13px] text-copy-muted">
            {compact ? "After the final evaluation." : "Generated after the evaluation."}
          </p>
        </div>
      </div>
    </Card>
  );
}
