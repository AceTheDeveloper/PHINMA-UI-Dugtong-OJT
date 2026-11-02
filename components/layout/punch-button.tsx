"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Clock, LogOut } from "lucide-react";
import { timeInAction } from "@/app/(app)/student/logs/actions";
import { focusStyle } from "@/components/brand-link";
import { formatClock } from "@/lib/logs/logic";
import type { PunchState } from "@/lib/layout/punch";
import { cn } from "@/lib/utils";

// The centre of the student's phone bar: the daily action, one tap from every
// page. "Time in" does it right here (the server clock sets the time and the
// database checks the schedule). "Time out" takes the student to the journal form,
// because a journal is needed to time out. Any other moment is a quiet link.

const circle =
  "grid size-14 place-items-center rounded-full ring-4 ring-background transition-transform active:scale-95";

export function PunchButton({ punch }: { punch: PunchState }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (punch.kind === "time_in") {
    return (
      <div className="relative flex h-16 flex-col items-center">
        {message ? (
          <p
            role="alert"
            className="absolute bottom-full mb-3 w-64 rounded-lg border border-error-border bg-error-tint px-3 py-2 text-sm text-error-text shadow-lift"
          >
            {message}
          </p>
        ) : null}
        <button
          type="button"
          disabled={pending}
          aria-label="Time in"
          onClick={() => {
            setMessage(null);
            startTransition(async () => {
              try {
                const result = await timeInAction();
                if (result.ok) router.refresh();
                else setMessage(result.error.message);
              } catch {
                setMessage("Something went wrong. Try again in a moment.");
              }
            });
          }}
          className={cn(circle, "-mt-5 bg-primary text-primary-foreground shadow-lift disabled:opacity-70", focusStyle)}
        >
          <Clock aria-hidden="true" className="size-6" />
        </button>
        <span className="mt-1 text-[13px] font-semibold text-ink">{pending ? "Timing in" : "Time in"}</span>
      </div>
    );
  }

  if (punch.kind === "time_out") {
    return (
      <Link
        href={punch.href}
        aria-label={`Time out. You timed in at ${formatClock(punch.timeIn)}.`}
        className={cn("relative flex h-16 flex-col items-center rounded-lg", focusStyle)}
      >
        <span className={cn(circle, "-mt-5 bg-teal text-white shadow-lift")}>
          <LogOut aria-hidden="true" className="size-6" />
        </span>
        <span
          aria-hidden="true"
          className="absolute right-[calc(50%-1.6rem)] top-[-1.1rem] size-3 rounded-full bg-teal-bright ring-2 ring-background"
        />
        <span className="mt-1 text-[13px] font-semibold text-ink">Time out</span>
      </Link>
    );
  }

  return (
    <Link
      href={punch.href}
      className={cn("relative flex h-16 flex-col items-center rounded-lg", focusStyle)}
    >
      <span className={cn(circle, "-mt-5 border border-border-strong bg-card text-copy-muted")}>
        <Clock aria-hidden="true" className="size-6" />
      </span>
      <span className="mt-1 text-[13px] font-semibold text-copy-muted">{punch.label}</span>
    </Link>
  );
}
