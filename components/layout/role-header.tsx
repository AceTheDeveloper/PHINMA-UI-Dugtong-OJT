"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import ThemeToggle from "@/app/components/theme-toggle";
import { BrandLink, focusStyle } from "@/components/brand-link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The top bar for a role's pages (students, supervisors): brand, the role's
// links, theme, and sign out. The links wrap onto their own row on narrow
// screens, so nothing scrolls.
export type NavLink = { href: string; label: string; exact: boolean };

export function RoleHeader({ label, links }: { label: string; links: readonly NavLink[] }) {
  const pathname = usePathname();
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex w-[min(100%_-_32px,1100px)] flex-wrap items-center gap-x-6 gap-y-1 py-2">
        <BrandLink size="sm" />
        <nav aria-label={label} className="order-3 flex w-full flex-wrap gap-1 sm:order-none sm:w-auto">
          {links.map((link) => {
            const current = link.exact
              ? pathname === link.href
              : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center rounded-lg px-3 text-sm font-semibold transition-colors",
                  current
                    ? "bg-primary-tint text-info-text"
                    : "text-copy-muted hover:bg-surface hover:text-ink",
                  focusStyle,
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <SignOutButton redirectUrl="/sign-in">
            <Button type="button" variant="outline" className="h-11 gap-2 px-3">
              <LogOut aria-hidden="true" className="size-4" />
              <span className="max-sm:sr-only">Sign out</span>
            </Button>
          </SignOutButton>
        </div>
      </div>
    </header>
  );
}
