import type { ReactNode } from "react";
import { focusStyle } from "@/components/brand-link";
import { GoogleMark } from "@/components/auth/google-mark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const authInput =
  "h-12 rounded-[10px] border-border-strong bg-background px-3.5 text-[15px] text-ink";

export const primaryAction = cn(
  "h-12 w-full rounded-[10px] bg-primary px-5 text-[15px] font-semibold text-primary-foreground hover:bg-primary-hover",
  focusStyle,
);

export const outlineAction = cn(
  "h-12 w-full rounded-[10px] border-border-strong bg-card px-5 text-[15px] font-semibold text-ink hover:bg-surface",
  focusStyle,
);

export function Field({
  id,
  label,
  aside,
  children,
}: {
  id: string;
  label: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {aside}
      </div>
      {children}
    </div>
  );
}

export function GoogleButton({
  onClick,
  disabled,
}: {
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={onClick}
      disabled={disabled}
      className={cn(outlineAction, "gap-3 disabled:opacity-60")}
    >
      <GoogleMark className="size-5" />
      Continue with Google
    </Button>
  );
}

export function OrDivider({ children }: { children: ReactNode }) {
  return (
    <div className="my-6 flex items-center gap-4">
      <span className="h-px flex-1 bg-border" />
      <span className="text-[13px] text-faint">{children}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
