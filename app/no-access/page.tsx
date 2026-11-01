import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { outlineAction, primaryAction } from "@/components/auth/auth-parts";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "No invitation found · Dugtong OJT",
};

// Mock: the email below is sample data.
export default function NoAccessPage() {
  return (
    <AuthShell>
      <div className="text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-warning-tint text-warning-text">
          <Mail className="size-6" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <h1 className="mt-6 font-heading text-[28px] font-extrabold leading-[1.2] tracking-[-0.04em]">
          No invitation found
        </h1>
        <p className="mt-3 text-base leading-[1.65] text-copy-muted">
          Dugtong is invitation-only, and there is no invitation for{" "}
          <strong className="font-semibold text-ink">someone@example.com</strong>
          . Ask your coordinator or company supervisor to invite you, then sign
          in again.
        </p>
        <div className="mt-7 grid gap-3">
          <Button
            nativeButton={false}
            render={<Link href="/sign-in" />}
            role="link"
            size="lg"
            className={primaryAction}
          >
            Try another account
          </Button>
          <Button
            nativeButton={false}
            render={<Link href="/sign-in" />}
            role="link"
            variant="outline"
            size="lg"
            className={outlineAction}
          >
            Sign out
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
