import type { Metadata } from "next";
import { SignOutButton } from "@clerk/nextjs";
import { Mail } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { outlineAction, primaryAction } from "@/components/auth/auth-parts";
import { Button } from "@/components/ui/button";
import { getClerkIdentity } from "@/lib/auth/clerk";

export const metadata: Metadata = {
  title: "No invitation found · Dugtong OJT",
};

// Shown to a signed-in person who has no account here. Signing out lets them
// try another account.
export default async function NoAccessPage() {
  const identity = await getClerkIdentity();

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
          <strong className="break-all font-semibold text-ink">
            {identity?.email ?? "this account"}
          </strong>
          . Ask your coordinator or company supervisor to invite you, then sign
          in again.
        </p>
        <div className="mt-7 grid gap-3">
          <SignOutButton redirectUrl="/sign-in">
            <Button type="button" size="lg" className={primaryAction}>
              Try another account
            </Button>
          </SignOutButton>
          <SignOutButton redirectUrl="/sign-in">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className={outlineAction}
            >
              Sign out
            </Button>
          </SignOutButton>
        </div>
      </div>
    </AuthShell>
  );
}
