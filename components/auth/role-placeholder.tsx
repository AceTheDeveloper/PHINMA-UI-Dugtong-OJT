import { SignOutButton } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth/auth-shell";
import { outlineAction } from "@/components/auth/auth-parts";
import { Button } from "@/components/ui/button";

// Stand-in home for a role until its real screens are built. Role homes sit
// behind requireRole, so reaching one proves the whole sign-in path works.
export function RolePlaceholder({ title }: { title: string }) {
  return (
    <AuthShell>
      <div className="text-center">
        <h1 className="font-heading text-[28px] font-extrabold leading-[1.2] tracking-[-0.04em]">
          {title}
        </h1>
        <p className="mt-3 text-base leading-[1.65] text-copy-muted">
          You are signed in. This area is coming soon.
        </p>
        <div className="mt-7">
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
