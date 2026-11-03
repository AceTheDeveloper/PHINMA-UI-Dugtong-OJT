import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import OjtDashboardView from '@/components/dashboard/OjtDashboardView';
import ThemeToggle from '@/app/components/theme-toggle';
import { BrandLink, focusStyle } from '@/components/brand-link';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-page-wash text-ink flex flex-col font-sans transition-colors duration-200">
      {/* ── TOP NAV HEADER ── */}
      <header className="sticky top-0 z-30 bg-card/90 backdrop-blur-md border-b border-border px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            title="Return to landing page"
            className={cn(
              "p-2 rounded-lg border border-border hover:bg-surface text-copy-muted transition-colors",
              focusStyle
            )}
          >
            <ArrowLeft className="size-4" />
          </Link>
          <BrandLink />
          <span className="hidden sm:inline-block text-xs font-mono text-border-strong">/</span>
          <span className="hidden sm:inline-block text-xs font-semibold text-copy-muted">
            OJT Operations Portal
          </span>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-border text-xs text-copy-muted">
            <span className="size-2 rounded-full bg-success" />
            <span className="font-semibold text-ink">Neil Alisasis</span>
            <span>(BSIT 4-A)</span>
          </div>
        </div>
      </header>

      {/* ── DASHBOARD MAIN CONTENT ── */}
      <main className="flex-1 mx-auto w-[min(100%_-_64px,1200px)] max-md:w-[calc(100%_-_48px)] py-8 space-y-8">
        <OjtDashboardView />
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border bg-card py-6 px-6 mt-12 text-xs text-copy-muted">
        <div className="mx-auto w-[min(100%_-_64px,1200px)] max-md:w-[calc(100%_-_48px)] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            © 2026 PHINMA University of Iloilo — College of Information Technology Education (CITE)
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span>BSIT Practicum Hours Portal</span>
            <span>•</span>
            <span>Server Clock: Asia/Manila</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

