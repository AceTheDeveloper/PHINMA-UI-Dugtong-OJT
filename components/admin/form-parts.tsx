"use client";

import { forwardRef, useState, useTransition, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { Result } from "@/lib/result";

// Pieces shared by every Admin form: a labelled field, a native select styled
// like the inputs, an inline error, a sheet that holds a form, and the hook
// that runs a server action and reports its typed result.

export function FormField({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-error-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const NativeSelect = forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select">
>(function NativeSelect({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive dark:bg-input/30",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export function FormMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-error-border bg-error-tint px-3 py-2 text-sm text-error-text"
    >
      {message}
    </p>
  );
}

// Runs a server action and keeps its failure message for the form to show.
export function useAction() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(
    action: () => Promise<Result<null>>,
    onDone?: () => void,
  ) {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          onDone?.();
        } else {
          setMessage(result.error.message);
        }
      } catch {
        setMessage("Something went wrong. Try again in a moment.");
      }
    });
  }

  return { pending, message, run, clear: () => setMessage(null) };
}

// A button that opens a side sheet holding a form. The form gets `close` to
// shut the sheet once the action succeeds.
export function FormSheet({
  trigger,
  title,
  description,
  variant = "default",
  size = "default",
  showPlus = true,
  disabled = false,
  children,
}: {
  trigger: string;
  title: string;
  description: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
  showPlus?: boolean;
  disabled?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button type="button" variant={variant} size={size} disabled={disabled} />}
      >
        {showPlus ? <Plus aria-hidden="true" data-icon="inline-start" /> : null}
        {trigger}
      </SheetTrigger>
      <SheetContent className="gap-0 data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="font-heading text-lg font-bold text-ink">{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">{children(() => setOpen(false))}</div>
      </SheetContent>
    </Sheet>
  );
}

export function SubmitRow({
  label,
  pendingLabel,
  pending,
}: {
  label: string;
  pendingLabel: string;
  pending: boolean;
}) {
  return (
    <Button type="submit" disabled={pending} className="mt-2 w-full">
      {pending ? pendingLabel : label}
    </Button>
  );
}
