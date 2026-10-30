import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import ScrollReveal from "./components/scroll-reveal";

function Logo() {
  return (
    <Image
      src="/dugtong-logo.png"
      alt="Dugtong OJT"
      width={48}
      height={48}
      className="size-10 object-contain"
      priority
    />
  );
}

function Avatar({
  initials,
  tone,
}: {
  initials: string;
  tone: "blue" | "teal" | "slate";
}) {
  const tones = {
    blue: "bg-primary-tint text-info-text",
    teal: "bg-teal-tint text-teal-text",
    slate: "bg-neutral-tint text-neutral-text",
  };

  return (
    <span
      className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold ${tones[tone]}`}
    >
      {initials}
    </span>
  );
}

function Status({
  children,
  tone,
  className = "",
}: {
  children: React.ReactNode;
  tone: "approved" | "pending";
  className?: string;
}) {
  const tones = {
    approved: "border-success-border bg-success-tint text-success-text",
    pending: "border-warning-border bg-warning-tint text-warning-text",
  };

  return (
    <span
      className={`inline-flex min-h-6 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-semibold leading-tight ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

function ProgressBar({ value = 26 }: { value?: number }) {
  return (
    <div className="h-[7px] w-full overflow-hidden rounded-full bg-primary-track">
      <span
        className="block h-full rounded-full bg-primary"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function HeroSample() {
  return (
    <div
      className="relative min-h-[500px] max-md:min-h-[480px] max-sm:min-h-[418px]"
      role="img"
      aria-label="Sample data showing a coordinator dashboard and a student's daily log"
    >
      <div className="absolute left-0 top-[26px] w-[min(82%,500px)] rounded-xl border border-border bg-surface p-6 max-sm:top-2 max-sm:w-[calc(100%-14px)] max-sm:px-[14px] max-sm:pb-[14px] max-sm:pt-[17px]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase leading-[1.4] tracking-[0.06em] text-faint">
              Coordinator view
            </p>
            <p className="mt-1 font-heading text-xl font-bold leading-[1.3] tracking-[-0.02em] max-sm:text-[17px]">
              Student progress
            </p>
          </div>
          <span className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-copy-muted">
            Today
          </span>
        </div>
        <div className="my-6 flex items-center justify-start gap-[22px] border-y border-border py-4 max-sm:my-[18px] max-sm:gap-3">
          <div className="grid gap-0.5">
            <span className="text-[11px] text-faint">Approved hours</span>
            <strong className="text-[21px] leading-[1.3] max-sm:text-lg">
              126 <small className="text-[11px] font-normal text-faint">/ 486</small>
            </strong>
          </div>
          <span className="h-8 w-px bg-border-strong" />
          <div className="grid gap-0.5">
            <span className="text-[11px] text-faint">Pending review</span>
            <strong className="text-[21px] leading-[1.3] max-sm:text-lg">
              04 <small className="text-[11px] font-normal text-faint">entries</small>
            </strong>
          </div>
        </div>
        <div className="flex items-center justify-between px-0.5 pb-2 text-[11px] text-faint">
          <span>Student</span>
          <span>Status</span>
        </div>
        <div className="flex min-h-[52px] items-center justify-between gap-2 border-t border-border text-xs max-sm:text-[11px]">
          <span className="flex min-w-0 items-center gap-2 font-semibold">
            <Avatar initials="MR" tone="blue" />
            Mara Reyes
          </span>
          <Status tone="approved">Approved</Status>
        </div>
        <div className="flex min-h-[52px] items-center justify-between gap-2 border-t border-border text-xs max-sm:text-[11px]">
          <span className="flex min-w-0 items-center gap-2 font-semibold">
            <Avatar initials="JL" tone="teal" />
            Julian Lim
          </span>
          <Status tone="pending">Pending</Status>
        </div>
        <div className="flex min-h-[52px] items-center justify-between gap-2 border-t border-border text-xs max-sm:text-[11px]">
          <span className="flex min-w-0 items-center gap-2 font-semibold">
            <Avatar initials="AC" tone="slate" />
            Alex Cruz
          </span>
          <Status tone="approved">Approved</Status>
        </div>
      </div>

      <div className="absolute bottom-0 right-3 z-[2] w-[232px] rounded-[32px] border border-border-strong bg-ink p-2 shadow-[0_18px_44px_color-mix(in_srgb,var(--ink)_18%,transparent)] max-md:right-0 max-sm:w-[198px] max-sm:rounded-[28px] max-sm:p-[7px]">
        <span className="absolute left-1/2 top-[14px] z-[1] h-[5px] w-14 -translate-x-1/2 rounded-full bg-copy-muted" />
        <div className="min-h-[442px] overflow-hidden rounded-[25px] bg-surface max-sm:min-h-[408px] max-sm:rounded-[22px]">
          <div className="flex h-14 items-center justify-between border-b border-border px-3.5 py-2 text-[11px] font-semibold">
            <Logo />
            <span>Daily log</span>
            <span className="tracking-wider text-faint" aria-hidden="true">
              •••
            </span>
          </div>
          <div className="px-3.5 pb-4 pt-5 max-sm:px-3 max-sm:pb-3.5 max-sm:pt-[18px]">
            <p className="text-[9px] leading-[1.4] text-faint">
              Today, October 12
            </p>
            <p className="mb-4 mt-1 font-heading text-[19px] font-bold leading-[1.3] tracking-[-0.02em]">
              Hello, Mara
            </p>
            <div className="grid gap-0.5 rounded-lg border border-border bg-surface p-3">
              <span className="text-[10px] text-faint">Time in</span>
              <strong className="font-mono text-[19px]">08:02 AM</strong>
            </div>
            <Status tone="pending" className="mt-3 text-[9px]">
              <span className="size-1.5 rounded-full bg-warning" />
              Pending approval
            </Status>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-2 text-[10px]">
                <span className="text-faint">Hours progress</span>
                <strong>126 / 486</strong>
              </div>
              <ProgressBar />
              <p className="mt-1 text-[9px] text-faint">Approved hours</p>
            </div>
            <div className="mt-[18px] border-t border-border pt-3 text-[10px] font-semibold">
              <span>Daily journal</span>
              <span className="mt-2 grid gap-[5px]">
                <i className="h-1 w-full rounded-full bg-border-strong" />
                <i className="h-1 w-full rounded-full bg-border-strong" />
                <i className="h-1 w-2/3 rounded-full bg-border-strong" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentPanel() {
  return (
    <div
      className="w-full max-w-[480px] justify-self-center rounded-xl border border-border bg-surface p-6 max-sm:px-4 max-sm:py-5"
      aria-hidden="true"
    >
      <div className="flex min-h-7 items-center justify-between gap-3 border-b border-border pb-4 text-[13px] font-semibold">
        <span>My hours</span>
        <span className="text-[11px] font-normal text-faint">This term</span>
      </div>
      <div className="mb-3.5 mt-[22px] flex items-baseline gap-2">
        <strong className="font-heading text-[38px] font-bold leading-none tracking-[-0.04em]">
          126
        </strong>
        <span className="text-xs text-faint">approved hours</span>
      </div>
      <ProgressBar />
      <div className="mt-[9px] flex justify-between text-xs text-faint">
        <span>Progress toward requirement</span>
        <span>26%</span>
      </div>
    </div>
  );
}

function SupervisorPanel() {
  return (
    <div
      className="w-full max-w-[480px] justify-self-center rounded-xl border border-border bg-surface p-6 max-sm:px-4 max-sm:py-5"
      aria-hidden="true"
    >
      <div className="flex min-h-7 items-center justify-between gap-3 border-b border-border pb-4 text-[13px] font-semibold">
        <span>Today&apos;s entries</span>
        <Status tone="pending">2 pending</Status>
      </div>
      <div className="flex min-h-[58px] items-center gap-2.5 border-b border-border">
        <Avatar initials="MR" tone="blue" />
        <span className="text-xs font-semibold">Mara Reyes</span>
        <span className="ml-auto font-mono text-[11px] text-copy-muted">
          08:02
        </span>
      </div>
      <div className="flex min-h-[58px] items-center gap-2.5 border-b border-border">
        <Avatar initials="JL" tone="teal" />
        <span className="text-xs font-semibold">Julian Lim</span>
        <span className="ml-auto font-mono text-[11px] text-copy-muted">
          08:11
        </span>
      </div>
      <div className="mt-3.5 flex min-h-11 items-center gap-2 text-xs font-semibold text-success-text">
        <Check size={14} strokeWidth={2.5} />
        Approve all
      </div>
    </div>
  );
}

function CoordinatorPanel() {
  return (
    <div
      className="w-full max-w-[480px] justify-self-center rounded-xl border border-border bg-surface p-6 max-sm:px-4 max-sm:py-5"
      aria-hidden="true"
    >
      <div className="flex min-h-7 items-center justify-between gap-3 border-b border-border pb-4 text-[13px] font-semibold">
        <span>Progress overview</span>
        <span className="text-[11px] font-normal text-faint">All students</span>
      </div>
      {[
        { initials: "AC", name: "Alex Cruz", tone: "slate" as const, value: 42 },
        { initials: "MR", name: "Mara Reyes", tone: "blue" as const, value: 26 },
        { initials: "JL", name: "Julian Lim", tone: "teal" as const, value: 68 },
      ].map((student) => (
        <div
          className="flex min-h-[52px] items-center gap-[9px] border-b border-border last:border-b-0"
          key={student.initials}
        >
          <Avatar initials={student.initials} tone={student.tone} />
          <span className="min-w-[86px] text-[11px] font-semibold">
            {student.name}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary-track">
            <span
              className="block h-full rounded-full bg-teal"
              style={{ width: `${student.value}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function RoleRow({
  label,
  heading,
  children,
  visual,
  reverse = false,
}: {
  label: string;
  heading: string;
  children: React.ReactNode;
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div
      className="grid grid-cols-2 items-center gap-[clamp(48px,9vw,128px)] border-t border-border py-12 max-md:grid-cols-1 max-md:gap-6 max-md:py-9"
      data-reveal
    >
      <div className={reverse ? "order-2 max-md:order-none" : ""}>
        <p className="mb-3 text-sm font-semibold text-teal">{label}</p>
        <h2 className="mb-4 font-heading text-[clamp(30px,3vw,38px)] font-bold leading-[1.18] tracking-[-0.02em]">
          {heading}
        </h2>
        <p className="max-w-[450px] leading-[1.65] text-copy-muted">
          {children}
        </p>
      </div>
      <div
        className={`w-full max-w-[480px] justify-self-center max-md:justify-self-start ${reverse ? "order-1 max-md:order-none" : ""}`}
      >
        {visual}
      </div>
    </div>
  );
}

const focusStyle =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export default function Home() {
  return (
    <>
      <a
        className={`absolute left-2 top-2 z-20 -translate-y-[160%] rounded-lg bg-ink px-4 py-3 text-surface transition-transform duration-150 focus:translate-y-0 ${focusStyle}`}
        href="#main-content"
      >
        Skip to content
      </a>
      <header className="relative z-[5]">
        <div className="mx-auto flex min-h-[88px] w-[min(100%_-_64px,1200px)] items-center gap-8 max-sm:w-[calc(100%_-_48px)] max-sm:grid max-sm:min-h-0 max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-x-3 max-sm:gap-y-0 max-sm:py-2.5">
          <Link
            className={`inline-flex min-h-11 shrink-0 items-center gap-2.5 font-heading text-[19px] font-extrabold tracking-[-0.03em] max-sm:text-[17px] ${focusStyle}`}
            href="/"
            aria-label="Dugtong OJT home"
          >
            <Logo />
            <span>Dugtong</span>
          </Link>
          <nav
            className="ml-auto flex items-center gap-[clamp(20px,3vw,40px)] max-sm:col-span-full max-sm:col-start-1 max-sm:row-start-2 max-sm:ml-0 max-sm:mt-1 max-sm:gap-[22px]"
            aria-label="Main navigation"
          >
            <a
              className={`inline-flex min-h-11 items-center text-[15px] font-semibold text-copy-muted transition-colors duration-150 hover:text-primary-hover max-sm:text-sm ${focusStyle}`}
              href="#how-it-works"
            >
              How it works
            </a>
            <a
              className={`inline-flex min-h-11 items-center text-[15px] font-semibold text-copy-muted transition-colors duration-150 hover:text-primary-hover max-sm:text-sm ${focusStyle}`}
              href="#who-its-for"
            >
              Who it&apos;s for
            </a>
          </nav>
          <Button
            nativeButton={false}
            render={<Link href="/sign-in" />}
            role="link"
            variant="outline"
            size="lg"
            className={`h-11 min-w-[88px] rounded-lg border-border-strong bg-transparent px-4 text-ink hover:border-primary hover:bg-transparent hover:text-primary-hover max-sm:col-start-2 max-sm:row-start-1 ${focusStyle}`}
          >
            Sign in
          </Button>
        </div>
      </header>

      <ScrollReveal />
      <main id="main-content">
        <section className="bg-[linear-gradient(180deg,var(--page-wash),transparent)] pb-[88px] pt-16 max-lg:pb-16 max-lg:pt-10 max-sm:pb-16 max-sm:pt-8">
          <div className="mx-auto grid w-[min(100%_-_64px,1200px)] grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-center gap-[clamp(40px,6vw,80px)] max-lg:grid-cols-1 max-lg:gap-8 max-md:w-[calc(100%_-_48px)]">
            <div className="max-w-[520px] py-9 max-lg:max-w-[660px] max-lg:pb-0 max-lg:pt-5 max-sm:pt-3" data-reveal>
              <h1 className="mb-6 max-w-[600px] font-heading text-[clamp(56px,5.2vw,72px)] font-extrabold leading-[1.04] tracking-[-0.055em] max-lg:text-[clamp(48px,8vw,62px)] max-sm:mb-[18px] max-sm:text-[clamp(46px,12.4vw,56px)]">
                Replace the paper DTR.
              </h1>
              <p className="max-w-[540px] text-lg leading-[1.65] text-copy-muted max-sm:text-base">
                Students log their hours and a short daily journal. Supervisors
                approve them the same day. Coordinators see every student&apos;s
                progress without chasing signatures.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-6 max-md:mt-6 max-sm:gap-x-[18px] max-sm:gap-y-2.5">
                <Button
                  nativeButton={false}
                  render={<Link href="/sign-in" />}
                  role="link"
                  size="lg"
                  className={`h-12 min-w-[120px] rounded-lg bg-primary px-5 text-[15px] font-semibold text-white hover:bg-primary-hover ${focusStyle}`}
                >
                  Sign in
                </Button>
                <a
                  className={`inline-flex min-h-12 items-center gap-2 text-[15px] font-semibold text-primary-hover transition-[gap] duration-150 hover:gap-3 ${focusStyle}`}
                  href="#how-it-works"
                >
                  See how it works
                  <ArrowRight size={16} aria-hidden="true" />
                </a>
              </div>
              <p className="mt-4 text-sm text-faint">
                Accounts are created by your school.
              </p>
            </div>
            <div className="min-w-0 max-md:mx-auto max-md:w-full max-md:max-w-[700px]" data-reveal>
              <HeroSample />
              <p className="mt-2 text-right text-xs text-faint">Sample data</p>
            </div>
          </div>
        </section>

        <section
          className="pb-[120px] pt-[72px] max-lg:pb-[88px] max-lg:pt-16 max-sm:pb-[72px] max-sm:pt-14"
          id="how-it-works"
          data-reveal
        >
          <div className="mx-auto w-[min(100%_-_64px,1200px)] max-md:w-[calc(100%_-_48px)]">
            <div className="max-w-[680px]">
              <p className="mb-3 text-xs font-semibold uppercase leading-[1.4] tracking-[0.06em] text-faint">
                How it works
              </p>
              <h2 className="font-heading text-[clamp(34px,3.5vw,46px)] font-bold leading-[1.15] tracking-[-0.02em]">
                From a day&apos;s work to approved hours
              </h2>
            </div>
            <div className="relative mt-14 grid grid-cols-3 gap-10 before:absolute before:left-[8.3%] before:right-[8.3%] before:top-[18px] before:h-px before:bg-border-strong before:content-[''] max-md:mt-10 max-md:grid-cols-1 max-md:gap-7 max-md:before:bottom-[18px] max-md:before:left-[18px] max-md:before:right-auto max-md:before:top-[18px] max-md:before:h-auto max-md:before:w-px">
              <article className="relative z-[1] min-w-0">
                <div className="mb-6 flex size-[38px] items-center justify-center rounded-full border border-border-strong bg-surface font-mono text-[11px] text-copy-muted max-md:mb-0 max-md:row-span-4">
                  01
                </div>
                <div className="mb-5 mt-0 flex min-h-[58px] items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-3 max-md:ml-[56px] max-md:mb-[14px]">
                  <span className="text-xs text-faint">Time in</span>
                  <strong className="font-mono text-[13px]">08:02 AM</strong>
                  <span className="ml-auto size-1.5 rounded-full bg-success" />
                </div>
                <h3 className="mb-2.5 font-heading text-xl font-bold leading-[1.3] tracking-[-0.02em] max-md:ml-[56px]">
                  Log the day.
                </h3>
                <p className="max-w-[360px] text-base leading-[1.65] text-copy-muted max-md:ml-[56px]">
                  Students time in, time out, and write a short journal. The
                  time comes from the server, not the phone.
                </p>
              </article>
              <article className="relative z-[1] min-w-0">
                <div className="mb-6 flex size-[38px] items-center justify-center rounded-full border border-border-strong bg-surface font-mono text-[11px] text-copy-muted max-md:mb-0">
                  02
                </div>
                <div className="mb-5 flex min-h-[58px] items-center gap-[9px] rounded-xl border border-border bg-surface p-3 max-md:ml-[56px] max-md:mb-[14px]">
                  <Avatar initials="JL" tone="teal" />
                  <span className="truncate text-xs text-copy-muted">
                    Julian Lim
                  </span>
                  <Status tone="pending" className="ml-auto">
                    Pending
                  </Status>
                </div>
                <h3 className="mb-2.5 font-heading text-xl font-bold leading-[1.3] tracking-[-0.02em] max-md:ml-[56px]">
                  Approve it daily.
                </h3>
                <p className="max-w-[360px] text-base leading-[1.65] text-copy-muted max-md:ml-[56px]">
                  The company supervisor approves the entry, rejects it with a
                  reason, or corrects the times.
                </p>
              </article>
              <article className="relative z-[1] min-w-0">
                <div className="mb-6 flex size-[38px] items-center justify-center rounded-full border border-border-strong bg-surface font-mono text-[11px] text-copy-muted max-md:mb-0">
                  03
                </div>
                <div className="mb-5 min-h-[58px] rounded-xl border border-border bg-surface px-3.5 py-[13px] max-md:ml-[56px] max-md:mb-[14px]">
                  <div className="mb-2 flex items-center justify-between gap-2 text-[10px]">
                    <span className="text-faint">Approved hours</span>
                    <strong>126 / 486</strong>
                  </div>
                  <ProgressBar />
                </div>
                <h3 className="mb-2.5 font-heading text-xl font-bold leading-[1.3] tracking-[-0.02em] max-md:ml-[56px]">
                  Hours add up.
                </h3>
                <p className="max-w-[360px] text-base leading-[1.65] text-copy-muted max-md:ml-[56px]">
                  Only approved hours count. When the required hours are met,
                  the supervisor submits an evaluation and the certification
                  is generated.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section
          className="pb-[120px] pt-[72px] max-lg:pb-[88px] max-lg:pt-16 max-sm:pb-[72px] max-sm:pt-14"
          id="who-its-for"
        >
          <div className="mx-auto w-[min(100%_-_64px,1200px)] max-md:w-[calc(100%_-_48px)]">
            <div className="mb-8 max-w-[680px]" data-reveal>
              <p className="mb-3 text-xs font-semibold uppercase leading-[1.4] tracking-[0.06em] text-faint">
                Who it&apos;s for
              </p>
            </div>
            <RoleRow
              label="Students"
              heading="See your hours at a glance."
              visual={<StudentPanel />}
            >
              Track approved hours against your requirement, read your journal
              history, and get your certification when you finish.
            </RoleRow>
            <RoleRow
              label="Supervisors"
              heading="Approve in one pass."
              visual={<SupervisorPanel />}
              reverse
            >
              Review the day&apos;s entries together, approve them in bulk, and
              evaluate students when their hours are complete.
            </RoleRow>
            <RoleRow
              label="Coordinators"
              heading="Know where everyone stands."
              visual={<CoordinatorPanel />}
            >
              See every student&apos;s progress, spot approvals that are stuck,
              and export records and printable DTRs.
            </RoleRow>
          </div>
        </section>

        <section
          className="bg-surface py-[88px] max-sm:py-[72px]"
          data-reveal
        >
          <div className="mx-auto grid w-[min(100%_-_64px,1200px)] grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] items-start gap-16 max-lg:grid-cols-1 max-lg:gap-8 max-md:w-[calc(100%_-_48px)]">
            <div className="max-w-[430px]">
              <h2 className="font-heading text-[clamp(34px,3.5vw,46px)] font-bold leading-[1.15] tracking-[-0.02em]">
                Records you can rely on
              </h2>
            </div>
            <ul className="grid list-none grid-cols-2 gap-x-7 gap-y-5 p-0 max-sm:grid-cols-1 max-sm:gap-y-4">
              {[
                "Approved entries are locked. Reopening one is recorded.",
                "Every approval, correction, and rejection is kept with who made it and when.",
                "Students see only their own hours.",
                "Files stay private.",
                "Built to follow the Data Privacy Act of 2012.",
              ].map((item) => (
                <li
                  className="flex items-start gap-2.5 text-base leading-[1.55] text-copy-muted"
                  key={item}
                >
                  <Check
                    className="mt-[3px] shrink-0 text-teal"
                    size={17}
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-ink py-[76px] text-surface max-sm:py-16" data-reveal>
          <div className="mx-auto flex w-[min(100%_-_64px,1200px)] items-center justify-between gap-8 max-sm:w-[calc(100%_-_48px)] max-sm:flex-col max-sm:items-start max-sm:gap-6">
            <div>
              <h2 className="mb-2.5 font-heading text-[clamp(32px,4vw,44px)] font-bold leading-[1.15] tracking-[-0.02em]">
                Already have an invitation?
              </h2>
              <p className="text-base text-surface">
                Sign in with the email your school has on file.
              </p>
            </div>
            <Button
              nativeButton={false}
              render={<Link href="/sign-in" />}
              role="link"
              size="lg"
              className={`h-12 min-w-[126px] shrink-0 rounded-lg bg-surface px-5 text-[15px] font-semibold text-ink hover:bg-primary-tint ${focusStyle}`}
            >
              Sign in
            </Button>
          </div>
        </section>
      </main>

      <footer className="bg-surface">
        <div className="mx-auto flex min-h-24 w-[min(100%_-_64px,1200px)] items-center justify-between gap-6 max-sm:w-[calc(100%_-_48px)] max-sm:flex-wrap max-sm:gap-x-[18px] max-sm:py-[18px]">
          <Link
            className={`inline-flex min-h-11 shrink-0 items-center gap-2.5 font-heading text-base font-extrabold tracking-[-0.03em] ${focusStyle}`}
            href="/"
            aria-label="Dugtong OJT home"
          >
            <Image
              src="/dugtong-logo.png"
              alt="Dugtong OJT"
              width={34}
              height={34}
              className="size-[34px] object-contain"
            />
            <span>Dugtong</span>
          </Link>
          <Link
            className={`inline-flex min-h-11 items-center text-[15px] font-semibold text-copy-muted hover:text-primary-hover ${focusStyle}`}
            href="/sign-in"
          >
            Sign in
          </Link>
          <p className="text-[13px] text-faint max-sm:w-full max-sm:text-xs">
            2026 Dugtong OJT
          </p>
        </div>
      </footer>
    </>
  );
}
