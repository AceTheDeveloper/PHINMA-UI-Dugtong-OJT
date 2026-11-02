"use client";

import { usePathname } from "next/navigation";
import ThemeToggle from "@/app/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { currentLabel, type ShellLink } from "@/lib/nav";

// The slim bar above every page: the menu button, the name of the current
// section for context (each page carries its own title), and the theme switch.
export function ShellTopBar({ links }: { links: readonly ShellLink[] }) {
  const pathname = usePathname();
  const label = currentLabel(pathname, links);
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/90 px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1 pointer-coarse:size-11" aria-label="Toggle navigation" />
      <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
      {label ? <span className="truncate text-sm font-semibold text-copy-muted">{label}</span> : null}
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}
