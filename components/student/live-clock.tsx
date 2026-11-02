"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// The time right now in school time (Asia/Manila), ticking every second. Display
// only: it reads this device's clock, so nothing stored ever comes from it; the
// server stamps every time in and time out. It starts empty so the server and the
// browser render the same thing, then fills in after mount.

const clock = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
  timeZone: "Asia/Manila",
});

export function LiveClock({ className }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const first = window.setTimeout(() => setNow(new Date()), 0);
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);
  return (
    <time
      dateTime={now?.toISOString()}
      suppressHydrationWarning
      className={cn("block min-h-[1em] tabular-nums", className)}
    >
      {now ? clock.format(now) : " "}
    </time>
  );
}
