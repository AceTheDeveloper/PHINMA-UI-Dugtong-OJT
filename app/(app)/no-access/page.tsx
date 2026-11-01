import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { Mail, ShieldAlert, TriangleAlert } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { outlineAction, primaryAction } from "@/components/auth/auth-parts";
import { Button } from "@/components/ui/button";
import { getClerkIdentity } from "@/lib/auth/clerk";

export const metadata: Metadata = {
  title: "No access · Dugtong OJT",
};

// Shown to a signed-in person who cannot continue. The reason is carried in the
// link so each cause gets its own honest message.
export default async function NoAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const identity = await getClerkIdentity();
  const email = identity?.email ?? "this account";

  return (
    <AuthShell>
      <div className="text-center">
        {reason === "google" ? (
          <>
            <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-warning-tint text-warning-text">
              <ShieldAlert className="size-6" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <h1 className="mt-6 font-heading text-[28px] font-extrabold leading-[1.2] tracking-[-0.04em]">
              Admins sign in with Google only
            </h1>
            <p className="mt-3 text-base leading-[1.65] text-copy-muted">
              <strong className="break-all font-semibold text-ink">{email}</strong>{" "}
              is an admin account, but it has a password or no linked Google
              account. Admin accounts must use Google sign-in and have no
              password. Contact another developer to fix the account.
            </p>
          </>
        ) : reason === "error" ? (
          <>
            <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-error-tint text-error-text">
              <TriangleAlert className="size-6" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <h1 className="mt-6 font-heading text-[28px] font-extrabold leading-[1.2] tracking-[-0.04em]">
              We could not check your account
            </h1>
            <p className="mt-3 text-base leading-[1.65] text-copy-muted">
              Something went wrong on our side. Try again in a moment, and
              contact a developer if it keeps happening.
            </p>
            <div className="mt-7">
              <Button
                nativeButton={false}
                render={<Link href="/after-sign-in" />}
                role="link"
                size="lg"
                className={primaryAction}
              >
                Try again
              </Button>
            </div>
          </>
        ) : (
          <>
            <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-warning-tint text-warning-text">
              <Mail className="size-6" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <h1 className="mt-6 font-heading text-[28px] font-extrabold leading-[1.2] tracking-[-0.04em]">
              No invitation found
            </h1>
            <p className="mt-3 text-base leading-[1.65] text-copy-muted">
              Dugtong is invitation-only, and there is no invitation for{" "}
              <strong className="break-all font-semibold text-ink">{email}</strong>.
              Ask your coordinator or company supervisor to invite you, then
              sign in again.
            </p>
          </>
        )}
        <div className="mt-7 grid gap-3">
          <SignOutButton redirectUrl="/sign-in">
            <Button
              type="button"
              size="lg"
              variant={reason === "error" ? "outline" : "default"}
              className={reason === "error" ? outlineAction : primaryAction}
            >
              {reason === "error" ? "Sign out" : "Try another account"}
            </Button>
          </SignOutButton>
          {reason !== "error" && (
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
          )}
        </div>
      </div>
    </AuthShell>
  );
}
