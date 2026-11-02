"use client";

import ThemeToggle from "@/app/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { ShellContext } from "@/lib/layout/context";

// The slim bar above every page. It says where the person is working (their
// company, their course and batch, or the school) and today's date, so a page
// never has to ask "which batch is this?". Each page carries its own title; the
// bar does not repeat it.
export function ShellTopBar({
  context,
  dateLabel,
}: {
  context: ShellContext | null;
  dateLabel: string;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/90 px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1 pointer-coarse:size-11" aria-label="Toggle navigation" />
      <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
      {context ? (
        <p className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-[15px] font-semibold text-ink">{context.primary}</span>
          {context.secondary ? (
            <span className="hidden truncate text-sm text-copy-muted sm:inline">{context.secondary}</span>
          ) : null}
        </p>
      ) : null}
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <span className="hidden text-sm tabular-nums text-copy-muted sm:block">{dateLabel}</span>
        <ThemeToggle />
      </div>
    </header>
  );
}
