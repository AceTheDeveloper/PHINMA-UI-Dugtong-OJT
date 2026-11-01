import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import {
  authInput,
  Field,
  GoogleButton,
  OrDivider,
  primaryAction,
} from "@/components/auth/auth-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = {
  title: "Accept invitation · Dugtong OJT",
};

// Mock: the email and role below are sample data. Real invitations arrive in
// ticket-09.
export default function AcceptInvitationPage() {
  return (
    <AuthShell>
      <span className="inline-flex h-6 items-center rounded-full border border-teal-border bg-teal-tint px-2.5 text-xs font-semibold text-teal-text">
        You&apos;re invited
      </span>
      <h1 className="mt-4 font-heading text-[32px] font-extrabold leading-[1.15] tracking-[-0.04em]">
        Join Dugtong OJT
      </h1>
      <p className="mt-2.5 text-base leading-[1.65] text-copy-muted">
        Create your account to get started. This invitation is for:
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3.5">
        <span className="break-all text-[15px] font-semibold">
          ana.sample@example.com
        </span>
        <span className="inline-flex h-6 items-center rounded-full border border-info-border bg-info-tint px-2.5 text-xs font-semibold text-info-text">
          Student
        </span>
      </div>

      <div className="mt-7">
        <GoogleButton />
        <p className="mt-2 text-[13px] leading-normal text-faint">
          Use the Google account for the email above.
        </p>
      </div>
      <OrDivider>or set a password</OrDivider>

      <form className="grid gap-5">
        <Field id="new-password" label="Password">
          <Input
            id="new-password"
            name="new-password"
            type="password"
            autoComplete="new-password"
            placeholder="Create a password"
            className={authInput}
          />
        </Field>
        <Field id="confirm-password" label="Confirm password">
          <Input
            id="confirm-password"
            name="confirm-password"
            type="password"
            autoComplete="new-password"
            placeholder="Enter it again"
            className={authInput}
          />
        </Field>
        <p className="text-[13px] leading-normal text-copy-muted">
          Use at least 8 characters.
        </p>
        <Button
          nativeButton={false}
          render={<Link href="/consent" />}
          role="link"
          size="lg"
          className={primaryAction}
        >
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-faint">
        This invitation expires in 7 days.
      </p>
    </AuthShell>
  );
}
