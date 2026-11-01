import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import ThemeToggle from "@/app/components/theme-toggle";
import { BrandLink } from "@/components/brand-link";
import { clerkAppearance } from "@/components/auth/clerk-appearance";
import {
  CertificationCard,
  HoursCard,
  TodayCard,
} from "@/components/landing/sample-cards";

export const metadata: Metadata = {
  title: "Sign in · Dugtong OJT",
};

export default function SignInPage() {
  return (
    <div className="grid min-h-screen grid-cols-2 bg-background max-lg:grid-cols-1">
      <section className="flex min-w-0 flex-col px-14 pb-10 pt-7 max-sm:px-6">
        <header className="flex items-center justify-between gap-4">
          <BrandLink />
          <ThemeToggle />
        </header>
        <main
          id="main-content"
          className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10"
        >
          <h1 className="font-heading text-[clamp(34px,4vw,42px)] font-extrabold leading-[1.12] tracking-[-0.04em]">
            Welcome back
          </h1>
          <p className="mb-8 mt-3 text-base leading-[1.65] text-copy-muted">
            Sign in to continue your OJT.
          </p>
          <SignIn
            routing="hash"
            withSignUp={false}
            forceRedirectUrl="/after-sign-in"
            appearance={clerkAppearance}
          />
          <p className="mt-7 rounded-xl border border-border bg-surface px-4 py-3.5 text-sm leading-[1.6] text-copy-muted">
            Accounts are by invitation only. If you have not received one, ask
            your coordinator or company supervisor.
          </p>
        </main>
      </section>

      <aside
        aria-hidden="true"
        className="flex min-w-0 flex-col items-center justify-center gap-7 bg-primary-tint bg-[radial-gradient(var(--border-strong)_1px,transparent_1px)] bg-[length:22px_22px] px-10 py-14 max-lg:hidden"
      >
        <div className="grid w-full max-w-[420px] gap-4">
          <TodayCard showJournal={false} />
          <HoursCard className="ml-10" />
          <CertificationCard compact className="mr-10" />
        </div>
        <p className="text-xs text-faint">Sample data</p>
      </aside>
    </div>
  );
}
