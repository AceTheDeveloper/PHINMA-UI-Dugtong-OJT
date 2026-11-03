import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Check,
  ChartLine,
  GraduationCap,
} from "lucide-react";
import ThemeToggle from "@/app/components/theme-toggle";
import { BrandLink, focusStyle } from "@/components/brand-link";
import { Button } from "@/components/ui/button";
import {
  CertificationCard,
  HoursCard,
  PendingCard,
  TodayCard,
} from "@/components/landing/sample-cards";
import { TeamAvatar, team } from "@/components/landing/team-avatar";
import { isLandingOnly } from "@/lib/landing-only";
import { cn } from "@/lib/utils";

const container =
  "mx-auto w-[min(100%_-_64px,1200px)] max-md:w-[calc(100%_-_48px)]";
const sectionHeading =
  "font-heading text-[clamp(32px,3.5vw,44px)] font-bold leading-[1.15] tracking-[-0.02em]";
const primaryButton = cn(
  "h-12 min-w-[128px] rounded-lg bg-primary px-5 text-[15px] font-semibold text-primary-foreground hover:bg-primary-hover",
  focusStyle,
);
const dotGrid =
  "bg-primary-tint bg-[radial-gradient(var(--border-strong)_1px,transparent_1px)] bg-[length:22px_22px]";

const navLink = cn(
  "inline-flex min-h-11 items-center text-[15px] font-semibold text-copy-muted transition-colors duration-150 hover:text-primary-hover max-sm:text-sm",
  focusStyle,
);

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-page-wash/85 backdrop-blur-md transition-all">
      <div
        className={cn(
          container,
          "flex min-h-[72px] sm:min-h-[80px] items-center justify-between gap-4 py-2.5 sm:py-0",
        )}
      >
        {/* Left: Brand + Institutional Hub Badge */}
        <div className="flex items-center gap-3 shrink-0">
          <BrandLink size="md" />

          {/* <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-border-strong text-xs font-mono">
            <span className="font-bold text-ink tracking-tight">PHINMA UI</span>
            <span className="text-border-strong">•</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary-tint text-primary border border-primary/20">
              <span className="size-1.5 rounded-full bg-success animate-pulse" />
              CITE BSIT Pilot
            </span>
          </div> */}
        </div>

        {/* Center: Sleek Segmented Capsule Navigation */}
        <nav
          aria-label="Main navigation"
          className="hidden md:flex items-center gap-1 p-1 rounded-full border border-border bg-surface/70 backdrop-blur-xs text-xs font-semibold"
        >
          <a
            className="px-3.5 py-1.5 rounded-full text-copy-muted hover:text-ink hover:bg-card dark:hover:bg-card/80 transition-all"
            href="#how-it-works"
          >
            Journey
          </a>
          <a
            className="px-3.5 py-1.5 rounded-full text-copy-muted hover:text-ink hover:bg-card dark:hover:bg-card/80 transition-all"
            href="#telemetry-data"
          >
            Telemetry
          </a>
          <a
            className="px-3.5 py-1.5 rounded-full text-copy-muted hover:text-ink hover:bg-card dark:hover:bg-card/80 transition-all"
            href="#ojt-portal-preview"
          >
            Portal Deck
          </a>
          <a
            className="px-3.5 py-1.5 rounded-full text-copy-muted hover:text-ink hover:bg-card dark:hover:bg-card/80 transition-all"
            href="#who-its-for"
          >
            Who it&apos;s for
          </a>
          <a
            className="px-3.5 py-1.5 rounded-full text-copy-muted hover:text-ink hover:bg-card dark:hover:bg-card/80 transition-all"
            href="#team"
          >
            Team
          </a>
        </nav>

        {/* Right: Telemetry Ping, Theme Toggle & Action CTA */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Live Node Telemetry (Desktop) */}
          {/* <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-surface/60 font-mono text-[10px] text-copy-muted">
            <span className="size-1.5 rounded-full bg-success animate-pulse" />
            <span className="font-semibold text-ink">SYSTEM ONLINE</span>
            <span className="text-border-strong">•</span>
            <span>24ms</span>
          </div> */}

          <ThemeToggle />

          {/* <Link
            href="#ojt-portal-preview"
            className="inline-flex items-center gap-1.5 h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-xs transition-colors shadow-xs"
          >
            <span>Live Portal</span>
            <ArrowRight className="size-3.5" />
          </Link> */}

          {!isLandingOnly() && (
            <Button
              nativeButton={false}
              render={<Link href="/sign-in" />}
              role="link"
              size="sm"
              className={cn(
                "h-9 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-ink hover:bg-surface",
                focusStyle,
              )}
            >
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export function Hero() {
  return (
    <section className="border-b border-border bg-page-wash">
      <div
        className={cn(
          container,
          "flex flex-wrap items-center gap-14 pb-[88px] pt-[72px] max-md:gap-10 max-md:pb-14 max-md:pt-10",
        )}
      >
        <div className="min-w-0 max-w-[560px] flex-[1_1_460px]" data-reveal>
          <h1 className="mb-6 font-heading text-[clamp(42px,5.2vw,68px)] font-extrabold leading-[1.05] tracking-[-0.05em]">
            Your OJT, from application to certification.
          </h1>
          <p className="max-w-[520px] text-lg leading-[1.65] text-copy-muted max-sm:text-base">
            Apply to partner companies, log your hours and a short daily
            journal, get them approved the same day, and receive your
            certification when you finish. One place for students, supervisors,
            and coordinators.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            {!isLandingOnly() && (
              <Button
                nativeButton={false}
                render={<Link href="/sign-in" />}
                role="link"
                size="lg"
                className={primaryButton}
              >
                Sign in
              </Button>
            )}
            <a
              className={cn(
                "inline-flex min-h-12 items-center gap-2 text-[15px] font-semibold text-primary-hover transition-[gap] duration-150 hover:gap-3",
                focusStyle,
              )}
              href="#how-it-works"
            >
              See how it works
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
          <p className="mt-4 text-sm text-faint">
            Accounts are by invitation only.
          </p>
        </div>

        <div className="min-w-0 flex-[1_1_520px]" data-reveal>
          <div
            aria-hidden="true"
            className={cn(
              "relative mx-auto h-[520px] w-full max-w-[600px] overflow-hidden rounded-[28px] max-md:hidden",
              dotGrid,
            )}
          >
            <TodayCard className="absolute left-7 top-8 w-[270px]" />
            <HoursCard className="absolute right-7 top-[120px] w-[270px]" />
            <PendingCard className="absolute bottom-7 left-7 w-[290px]" />
            <CertificationCard className="absolute bottom-11 right-7 w-[220px]" />
          </div>
          <div
            aria-hidden="true"
            className={cn(
              "mx-auto hidden w-full max-w-[420px] gap-4 rounded-[28px] p-5 max-md:grid",
              dotGrid,
            )}
          >
            <TodayCard showJournal={false} />
            <HoursCard />
            <CertificationCard compact />
          </div>
          <p className="mt-3 text-center text-xs text-faint">Sample data</p>
        </div>
      </div>
    </section>
  );
}

const steps = [
  {
    n: "01",
    title: "Apply",
    text: "Students upload a resume and apply to listings from partner companies for their course.",
  },
  {
    n: "02",
    title: "Get accepted",
    text: "A supervisor accepts an applicant and the deployment starts right away.",
  },
  {
    n: "03",
    title: "Log the day",
    text: "Time in, time out, and a short journal. The time comes from the server, not the phone.",
  },
  {
    n: "04",
    title: "Approve daily",
    text: "The supervisor approves the entry, rejects it with a reason, or corrects the times.",
  },
  {
    n: "05",
    title: "Evaluate",
    text: "When the required hours are met, the supervisor submits the evaluation.",
  },
  {
    n: "06",
    title: "Get certified",
    text: "The certification is generated and the coordinator can export the records.",
  },
];

export function Journey() {
  return (
    <section id="how-it-works" className="py-24 max-sm:py-16" data-reveal>
      <div className={container}>
        <h2 className={cn(sectionHeading, "max-w-[640px]")}>
          One journey, six steps.
        </h2>
        <ol className="mt-12 grid list-none grid-cols-3 gap-6 p-0 max-lg:grid-cols-2 max-sm:grid-cols-1">
          {steps.map((step) => (
            <li
              key={step.n}
              className="rounded-2xl border border-border bg-surface p-7"
            >
              <span className="mb-5 inline-flex size-10 items-center justify-center rounded-full border border-border-strong bg-card font-mono text-[13px] font-semibold text-primary">
                {step.n}
              </span>
              <h3 className="mb-2.5 font-heading text-xl font-bold leading-[1.3] tracking-[-0.02em]">
                {step.title}
              </h3>
              <p className="text-base leading-[1.65] text-copy-muted">
                {step.text}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const roles = [
  {
    label: "Students",
    heading: "Find a company and track your hours.",
    text: "Apply with your resume, log each day, and see approved hours against your requirement until your certification is ready.",
    Icon: GraduationCap,
    tone: "bg-primary-tint text-info-text",
  },
  {
    label: "Supervisors",
    heading: "Approve the day in one pass.",
    text: "Post listings, accept applicants, approve entries in bulk, and submit the evaluation when a student's hours are complete.",
    Icon: Building2,
    tone: "bg-teal-tint text-teal-text",
  },
  {
    label: "Coordinators",
    heading: "Know where everyone stands.",
    text: "Import your roster, spot approvals that are stuck, and export records and printable DTRs without chasing signatures.",
    Icon: ChartLine,
    tone: "bg-success-tint text-success-text",
  },
];

export function Roles() {
  return (
    <section
      id="who-its-for"
      className="border-y border-border bg-page-wash py-24 max-sm:py-16"
      data-reveal
    >
      <div className={container}>
        <h2 className={cn(sectionHeading, "max-w-[640px]")}>
          Built for everyone in the OJT.
        </h2>
        <div className="mt-12 grid grid-cols-3 gap-6 max-md:grid-cols-1">
          {roles.map(({ label, heading, text, Icon, tone }) => (
            <article
              key={label}
              className="rounded-2xl border border-border bg-card p-8 shadow-md max-sm:p-6"
            >
              <span
                className={cn(
                  "mb-6 inline-flex size-12 items-center justify-center rounded-xl",
                  tone,
                )}
              >
                <Icon className="size-6" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <p className="mb-2 text-sm font-semibold text-teal-text">
                {label}
              </p>
              <h3 className="mb-3 font-heading text-2xl font-bold leading-[1.25] tracking-[-0.02em]">
                {heading}
              </h3>
              <p className="text-base leading-[1.65] text-copy-muted">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const trust = [
  "Approved entries are locked. Reopening one is recorded.",
  "Every approval, correction, and rejection is kept with who made it and when.",
  "Students see only their own hours.",
  "Files stay private.",
  "Built to follow the Data Privacy Act of 2012.",
];

export function Trust() {
  return (
    <section className="py-24 max-sm:py-16" data-reveal>
      <div className={cn(container, "flex flex-wrap items-start gap-14")}>
        <div className="max-w-[430px] flex-[1_1_360px]">
          <h2 className={sectionHeading}>Records you can rely on.</h2>
        </div>
        <ul className="grid min-w-0 flex-[1_1_520px] list-none grid-cols-2 gap-x-7 gap-y-5 p-0 max-sm:grid-cols-1">
          {trust.map((line) => (
            <li
              key={line}
              className="flex gap-3 text-base leading-[1.6] text-copy-muted"
            >
              <span className="mt-px inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-success-tint text-success-text">
                <Check
                  className="size-3.5"
                  strokeWidth={3}
                  aria-hidden="true"
                />
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Team() {
  return (
    <section
      id="team"
      className="border-y border-border bg-gradient-to-b from-background via-primary-tint to-primary-track py-28 max-sm:py-20"
      data-reveal
    >
      <div className={cn(container, "text-center")}>
        <h2 className="font-heading text-[clamp(36px,5.5vw,60px)] font-extrabold leading-[1.08] tracking-[-0.025em] text-balance">
          Built by <span className="text-primary">Nerds of a Feather</span>.
        </h2>
        <p className="mx-auto mt-3.5 max-w-[480px] text-base leading-[1.65] text-copy-muted">
          The people who build and maintain Dugtong OJT.
        </p>
        <ul className="mt-12 flex list-none flex-wrap justify-center gap-5 p-0">
          {team.map((person) => (
            <li
              key={person.name}
              className="flex w-[208px] flex-col items-center rounded-2xl border border-border bg-card px-5 py-7 max-sm:w-[calc(50%_-_10px)] max-sm:px-3"
            >
              <TeamAvatar person={person} />
              <p className="mt-4 font-heading text-lg font-bold">
                {person.name}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function FinalCta() {
  if (isLandingOnly()) return null;
  return (
    <section className="py-24 max-sm:py-16" data-reveal>
      <div
        className={cn(
          container,
          dotGrid,
          "rounded-[28px] px-12 py-16 text-center max-sm:px-6 max-sm:py-12",
        )}
      >
        <h2 className="font-heading text-[clamp(32px,4vw,44px)] font-bold leading-[1.15] tracking-[-0.02em]">
          Have an invitation?
        </h2>
        <p className="mx-auto mt-3 max-w-[460px] text-base leading-[1.65] text-copy-muted">
          Sign in with the email your invitation was sent to.
        </p>
        <div className="mt-7">
          <Button
            nativeButton={false}
            render={<Link href="/sign-in" />}
            role="link"
            size="lg"
            className={cn(primaryButton, "min-w-[140px]")}
          >
            Sign in
          </Button>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-border">
      <div
        className={cn(
          container,
          "flex flex-wrap items-center justify-between gap-4 py-7",
        )}
      >
        <BrandLink size="sm" />
        <p className="text-[13px] text-faint">
          Built for PHINMA University of Iloilo.
        </p>
        {!isLandingOnly() && (
          <Link
            href="/sign-in"
            className={cn(
              "inline-flex min-h-11 items-center text-sm font-semibold text-primary-hover",
              focusStyle,
            )}
          >
            Sign in
          </Link>
        )}
      </div>
    </footer>
  );
}
