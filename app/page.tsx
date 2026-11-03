import ScrollReveal from "./components/scroll-reveal";
import {
  FinalCta,
  Journey,
  LandingFooter,
  LandingHeader,
  Roles,
  Team,
  Trust,
} from "@/components/landing/landing-sections";
import OjtHero from "@/components/landing/OjtHero";
import OjtTelemetryData from "@/components/landing/OjtTelemetryData";
import OjtDashboardView from "@/components/dashboard/OjtDashboardView";
import { focusStyle } from "@/components/brand-link";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <>
      <a
        className={cn(
          "absolute left-2 top-2 z-20 -translate-y-[160%] rounded-lg bg-ink px-4 py-3 text-surface transition-transform duration-150 focus:translate-y-0 dark:bg-card dark:text-card-foreground",
          focusStyle,
        )}
        href="#main-content"
      >
        Skip to content
      </a>
      <LandingHeader />
      <ScrollReveal />
      <main id="main-content">
        {/* 1. Sleek Portfolio-Style Bento Hero */}
        <OjtHero />

        {/* 2. Minimalist Telemetry & Glowing SVG Curve Charts */}
        <OjtTelemetryData />

        {/* 3. The 6-Step Practicum Journey */}
        <Journey />

        {/* 4. Live Interactive OJT Dashboard Experience (Student & Supervisor Deck) */}
        <section
          id="ojt-portal-preview"
          className="border-y border-border bg-page-wash py-20 max-sm:py-14"
          data-reveal
        >
          <div className="mx-auto w-[min(100%_-_64px,1200px)] max-md:w-[calc(100%_-_48px)] space-y-6">
            <div className="space-y-2 max-w-[680px]">
              <span className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-card px-3 py-1 font-mono text-xs font-semibold text-primary">
                <span className="size-2 rounded-full bg-primary" />
                <span>Live Portal Experience</span>
              </span>
              <h2 className="font-heading text-[clamp(28px,3vw,38px)] font-bold leading-[1.2] tracking-[-0.02em] text-ink">
                Built for daily use by students and supervisors.
              </h2>
              <p className="text-base text-copy-muted leading-[1.6]">
                Experience the real OJT workflow. Clock in, submit daily journals, verify attendance, and monitor graduation hours in real time.
              </p>
            </div>
            <OjtDashboardView />
          </div>
        </section>

        {/* 5. User Roles Breakdown */}
        <Roles />

        {/* 6. Partner Trust, Team & Final CTA */}
        <Trust />
        <Team />
        <FinalCta />
      </main>
      <LandingFooter />
    </>
  );
}
