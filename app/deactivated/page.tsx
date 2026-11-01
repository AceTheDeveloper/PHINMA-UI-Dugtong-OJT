import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { outlineAction } from "@/components/auth/auth-parts";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Account deactivated · Dugtong OJT",
};

export default function DeactivatedPage() {
  return (
    <AuthShell>
      <div className="text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-neutral-tint text-neutral-text">
          <Lock className="size-6" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <h1 className="mt-6 font-heading text-[28px] font-extrabold leading-[1.2] tracking-[-0.04em]">
          This account is deactivated
        </h1>
        <p className="mt-3 text-base leading-[1.65] text-copy-muted">
          You can no longer use Dugtong with this account. If you think this is
          a mistake, contact your coordinator or company supervisor.
        </p>
        <div className="mt-7">
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
