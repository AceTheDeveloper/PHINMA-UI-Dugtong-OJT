import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  Building2,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "../components/theme-toggle";

const focusStyle =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const pathway = [
  { label: "School", Icon: GraduationCap },
  { label: "Company", Icon: Building2 },
  { label: "Completion", Icon: Award },
];

function PathwayIllustration() {
  return (
    <section
      aria-labelledby="pathway-heading"
      className="order-1 flex min-h-[208px] items-center justify-center bg-ink px-6 py-7 text-surface dark:bg-card dark:text-card-foreground sm:min-h-[224px] lg:order-2 lg:min-h-svh lg:px-12 lg:py-16"
    >
      <div className="w-full max-w-[560px]">
        <h2
          id="pathway-heading"
          className="mb-5 text-center font-heading text-sm font-bold tracking-[0.04em] text-surface dark:text-card-foreground lg:mb-12 lg:text-left lg:text-base"
        >
          Campus to career
        </h2>
        <div
          role="img"
          aria-label="Illustration of the pathway from School to Company to Completion"
          className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4 lg:gap-5"
        >
          {pathway.map(({ label, Icon }, index) => (
            <div className="contents" key={label}>
              <div className="flex min-w-0 flex-col items-center gap-2 text-center lg:gap-4">
                <span className="flex size-11 items-center justify-center rounded-full bg-primary-tint text-info-text sm:size-12 lg:size-16">
                  <Icon
                    aria-hidden="true"
                    className="size-5 sm:size-6 lg:size-7"
                    strokeWidth={1.8}
                  />
                </span>
                <span className="text-xs font-semibold sm:text-sm lg:text-base">
                  {label}
                </span>
              </div>
              {index < pathway.length - 1 && (
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 text-teal-text sm:size-5"
                  strokeWidth={2}
                />
              )}
            </div>
          ))}
        </div>
        <div
          aria-hidden="true"
          className="mx-auto mt-5 h-px w-3/4 bg-surface/20 lg:mt-12"
        />
        <p className="mt-4 text-center text-xs text-surface/75 dark:text-card-foreground/75 lg:text-left lg:text-sm">
          School <span className="text-teal-text">→</span> Company{" "}
          <span className="text-teal-text">→</span> Completion
        </p>
      </div>
    </section>
  );
}

function SignInForm() {
  return (
    <section className="order-2 flex min-w-0 flex-col px-6 pb-12 pt-5 sm:px-10 lg:order-1 lg:px-12 lg:py-8">
      <header className="flex items-center justify-between">
        <Link
          className={`inline-flex min-h-11 items-center gap-2.5 font-heading text-[19px] font-extrabold tracking-[-0.03em] max-sm:text-[17px] ${focusStyle}`}
          href="/"
          aria-label="Dugtong OJT home"
        >
          <Image
            src="/dugtong-mark.png"
            alt=""
            width={48}
            height={48}
            className="size-10 object-contain"
            priority
          />
          <span>Dugtong</span>
        </Link>
        <ThemeToggle />
      </header>

      <div
        id="sign-in-form"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10 outline-none lg:py-16"
      >
        <h1 className="font-heading text-[clamp(34px,5vw,44px)] font-extrabold leading-[1.12] tracking-[-0.04em]">
          Sign in
        </h1>
        <p className="mt-3 text-base leading-[1.65] text-copy-muted">
          Sign in with the email your school has on file.
        </p>

        <fieldset className="mt-8 grid gap-5 border-0 p-0">
          <legend className="sr-only">Sign-in details</legend>
          <div className="grid gap-2">
            <label htmlFor="email" className="text-sm font-semibold">
              Email
            </label>
            <input
              autoComplete="username"
              className="h-12 w-full rounded-lg border border-border-strong bg-background px-3 text-ink outline-none transition-colors placeholder:text-faint focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30"
              id="email"
              name="email"
              type="email"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="password" className="text-sm font-semibold">
              Password
            </label>
            <input
              autoComplete="current-password"
              className="h-12 w-full rounded-lg border border-border-strong bg-background px-3 text-ink outline-none transition-colors placeholder:text-faint focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30"
              id="password"
              name="password"
              type="password"
            />
          </div>
          <Button
            className={`mt-1 h-12 w-full rounded-lg bg-primary px-5 text-[15px] font-semibold text-primary-foreground hover:bg-primary-hover ${focusStyle}`}
            type="button"
          >
            Sign in
          </Button>
        </fieldset>
      </div>

      <p className="text-center text-xs text-faint">
        PHINMA University of Iloilo · CITE
      </p>
    </section>
  );
}

export default function SignInPage() {
  return (
    <main
      id="main-content"
      className="grid min-h-svh bg-background lg:grid-cols-2"
    >
      <a
        className={`absolute left-2 top-2 z-20 -translate-y-[160%] rounded-lg bg-ink px-4 py-3 text-surface transition-transform duration-150 focus:translate-y-0 dark:bg-card dark:text-card-foreground ${focusStyle}`}
        href="#sign-in-form"
      >
        Skip to content
      </a>
      <SignInForm />
      <PathwayIllustration />
    </main>
  );
}
