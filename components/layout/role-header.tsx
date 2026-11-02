"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import ThemeToggle from "@/app/components/theme-toggle";
import { BrandLink, focusStyle } from "@/components/brand-link";
import { Button } from "@/components/ui/button";
import { isCurrentLink, type NavLink } from "@/lib/nav";
import { cn } from "@/lib/utils";

// The top bar for a role's pages: brand, the role's links, theme, and sign out.
// On phones the links either wrap onto their own row or, for students, move to
// the bottom tab bar (navOnPhones = false) so the daily action stays under the
// thumb.
export function RoleHeader({
  label,
  links,
  navOnPhones = true,
}: {
  label: string;
  links: readonly NavLink[];
  navOnPhones?: boolean;
}) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-[min(100%-32px,1100px)] flex-wrap items-center gap-x-6 gap-y-1 py-2">
        <BrandLink size="sm" />
        <nav
          aria-label={label}
          className={cn(
            "order-3 w-full flex-wrap gap-1 sm:order-0 sm:flex sm:w-auto",
            navOnPhones ? "flex" : "hidden",
          )}
        >
          {links.map((link) => {
            const current = isCurrentLink(pathname, link);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 items-center rounded-lg px-3.5 text-[15px] font-semibold transition-colors",
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
