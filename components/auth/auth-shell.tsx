import type { ReactNode } from "react";
import ThemeToggle from "@/app/components/theme-toggle";
import { BrandLink } from "@/components/brand-link";
import { cn } from "@/lib/utils";

// Centered card on the page wash, used by the single-card auth screens.
export function AuthShell({
  children,
  maxWidth = "max-w-[480px]",
  headerAction,
}: {
  children: ReactNode;
  maxWidth?: string;
  headerAction?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-page-wash">
      <header className="mx-auto flex w-[min(100%_-_64px,1200px)] items-center justify-between gap-4 py-7 max-sm:w-[calc(100%_-_48px)]">
        <BrandLink />
        <div className="flex items-center gap-3">
          {headerAction}
          <ThemeToggle />
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-6 pb-16 pt-6">
        <div
          className={cn(
            "w-full rounded-2xl border border-border bg-card p-10 shadow-md max-sm:p-6",
            maxWidth,
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
