import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ConsentForm } from "@/components/auth/consent-form";
import { focusStyle } from "@/components/brand-link";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Data privacy consent · Dugtong OJT",
};

// Draft wording. The retention period is a placeholder until the school
// answers (see to-confirm.md).
const summary = [
  {
    title: "What we collect",
    text: "Your name, student number, email, resume, hours, journal entries, and evaluation.",
  },
  {
    title: "Why we collect it",
    text: "To run your OJT: applications, daily logs, approvals, evaluation, and certification.",
  },
  {
    title: "Who can see it",
    text: "You, your company supervisor, and your coordinator. Nobody else.",
  },
  {
    title: "How long we keep it",
    text: "[Retention period to be confirmed by the school]",
  },
];

export default function ConsentPage() {
  return (
    <AuthShell
      maxWidth="max-w-[640px]"
      headerAction={
        <Link
          href="/sign-in"
          className={cn(
            "inline-flex min-h-11 items-center text-sm font-semibold text-copy-muted hover:text-ink",
            focusStyle,
          )}
        >
          Sign out
        </Link>
      }
    >
      <h1 className="font-heading text-[32px] font-extrabold leading-[1.15] tracking-[-0.04em]">
        Before you start
      </h1>
      <p className="mt-2.5 text-base leading-[1.65] text-copy-muted">
        Dugtong collects your data only for your on-the-job training. Here is
        how it is used.
      </p>

      <div className="mt-7 grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        {summary.map((item) => (
          <section
            key={item.title}
            className="rounded-xl border border-border bg-surface p-[18px]"
          >
            <h2 className="mb-1.5 font-heading text-[15px] font-bold tracking-normal">
              {item.title}
            </h2>
            <p className="text-sm leading-[1.6] text-copy-muted">{item.text}</p>
          </section>
        ))}
      </div>

      <p className="mt-5 text-sm leading-[1.6] text-copy-muted">
        This follows the Data Privacy Act of 2012. To see, correct, or remove
        your data, ask your coordinator.
      </p>

      <ConsentForm />
    </AuthShell>
  );
}
