"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, FileText, House, Send } from "lucide-react";
import { focusStyle } from "@/components/brand-link";
import { isCurrentLink, type NavLink } from "@/lib/nav";
import { cn } from "@/lib/utils";

// The phone navigation: tabs along the bottom edge, where the thumb rests. The
// current tab is marked with the teal dot from the Dugtong mark. Hidden from
// small tablets up, where the top bar carries the links.
// Tabs name their icon instead of passing the component: a server component
// cannot hand a function to this client component.
const icons = { home: House, listings: Briefcase, applications: Send, resume: FileText };

export type Tab = NavLink & { icon: keyof typeof icons };

export function BottomTabs({ label, tabs }: { label: string; tabs: readonly Tab[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {tabs.map((tab) => {
          const current = isCurrentLink(pathname, tab);
          const Icon = icons[tab.icon];
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 text-[13px] font-semibold transition-colors",
                  current ? "text-ink" : "text-copy-muted",
                  focusStyle,
                )}
              >
                {current ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-1.5 size-1.5 rounded-full bg-teal"
                  />
                ) : null}
                <Icon
                  aria-hidden="true"
                  className={cn("mt-2 size-5", current ? "text-primary" : "")}
                />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
