import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth/auth-shell";
import { clerkAppearance } from "@/components/auth/clerk-appearance";

export const metadata: Metadata = {
  title: "Accept invitation · Dugtong OJT",
};

// Clerk reads the invitation from the link (__clerk_ticket), shows the invited
// email, and offers Google or a password. Invite-only mode in Clerk means this
// is the only way to create an account.
export default function AcceptInvitationPage() {
  return (
    <AuthShell>
      <span className="inline-flex h-6 items-center rounded-full border border-teal-border bg-teal-tint px-2.5 text-xs font-semibold text-teal-text">
        You&apos;re invited
      </span>
      <h1 className="mt-4 font-heading text-[32px] font-extrabold leading-[1.15] tracking-[-0.04em]">
        Join Dugtong OJT
      </h1>
      <p className="mb-7 mt-2.5 text-base leading-[1.65] text-copy-muted">
        Create your account to accept your invitation. Use the email the
        invitation was sent to.
      </p>
      <SignUp
        routing="hash"
        signInUrl="/sign-in"
        forceRedirectUrl="/after-sign-in"
        appearance={clerkAppearance}
      />
      <p className="mt-6 text-center text-[13px] text-faint">
        This invitation expires in 7 days.
      </p>
    </AuthShell>
  );
}
