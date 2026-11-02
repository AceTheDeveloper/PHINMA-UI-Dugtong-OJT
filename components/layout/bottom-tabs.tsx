"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { focusStyle } from "@/components/brand-link";
import { navIcons } from "@/components/layout/nav-icons";
import { isCurrentLink, type ShellLink } from "@/lib/nav";
import { cn } from "@/lib/utils";

// The phone navigation: tabs along the bottom edge, where the thumb rests. The
// current tab is marked with the teal dot from the Dugtong mark. Hidden from
// tablets up, where the sidebar carries the links.

export function BottomTabs({ label, tabs }: { label: string; tabs: readonly ShellLink[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {tabs.map((tab) => {
          if (tab.href === null) return null;
          const href = tab.href;
          const current = isCurrentLink(pathname, { href, label: tab.label, exact: tab.exact });
          const Icon = navIcons[tab.icon];
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
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
