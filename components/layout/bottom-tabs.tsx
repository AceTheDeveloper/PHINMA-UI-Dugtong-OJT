"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { focusStyle } from "@/components/brand-link";
import { navIcons } from "@/components/layout/nav-icons";
import { PunchButton } from "@/components/layout/punch-button";
import { useSidebar } from "@/components/ui/sidebar";
import { todayHref, type PunchState } from "@/lib/layout/punch";
import { isCurrentLink, type BottomBar } from "@/lib/nav";
import { cn } from "@/lib/utils";

// The phone navigation: a bar along the bottom edge, where the thumb rests. The
// current tab is marked with the teal dot from the Dugtong mark. Students get the
// punch button in the middle; supervisors get a count on Approvals and a More tab
// that opens the full menu. Hidden from tablets up, where the sidebar carries the
// links.

const cell = "relative flex h-16 flex-col items-center justify-center gap-1 text-[13px] font-semibold transition-colors";

export function BottomTabs({
  bar,
  badges,
  punch,
}: {
  bar: BottomBar;
  badges: Record<string, number>;
  punch: PunchState | null;
}) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const fallback: PunchState = { kind: "idle", label: "Today", href: todayHref };

  const items = bar.tabs.map((tab) => {
    if (tab.href === null) return null;
    const href = tab.href;
    const current = isCurrentLink(pathname, { href, label: tab.label, exact: tab.exact, also: tab.also });
    const Icon = navIcons[tab.icon];
    const count = badges[href] ?? 0;
    return (
      <li key={href}>
        <Link
          href={href}
          aria-current={current ? "page" : undefined}
          className={cn(cell, current ? "text-ink" : "text-copy-muted", focusStyle)}
        >
          {current ? (
            <span aria-hidden="true" className="absolute top-1.5 size-1.5 rounded-full bg-teal-bright" />
          ) : null}
          <span className="relative mt-2">
            <Icon aria-hidden="true" className={cn("size-5", current ? "text-primary" : "")} />
            {count > 0 ? (
              <span className="absolute -right-3 -top-2 min-w-5 rounded-full bg-warning px-1 text-center text-xs font-bold leading-5 text-white">
                {count > 99 ? "99+" : count}
                <span className="sr-only"> waiting</span>
              </span>
            ) : null}
          </span>
          {tab.label}
        </Link>
      </li>
    );
  });

  // The punch button sits in the middle of the row.
  const cells = items.filter((item) => item !== null);
  if (bar.punch) {
    cells.splice(Math.floor(cells.length / 2), 0, (
      <li key="punch">
        <PunchButton punch={punch ?? fallback} />
      </li>
    ));
  }
  if (bar.more) {
    const MenuIcon = navIcons.menu;
    cells.push(
      <li key="more">
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className={cn(cell, "w-full text-copy-muted", focusStyle)}
        >
          <MenuIcon aria-hidden="true" className="mt-2 size-5" />
          More
        </button>
      </li>,
    );
  }

  return (
    <nav
      aria-label={bar.label}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul
        className="mx-auto grid max-w-lg"
        style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
      >
        {cells}
      </ul>
    </nav>
  );
}
