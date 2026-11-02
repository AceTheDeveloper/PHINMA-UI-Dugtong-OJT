"use client";

import { useState } from "react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { MailCheck } from "lucide-react";
import { primaryAction } from "@/components/auth/auth-parts";
import { focusStyle } from "@/components/brand-link";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import type { SignInOutcome } from "@/lib/auth/sign-in-flow";
import { cn } from "@/lib/utils";

// The "Check your email" step, shared by sign-in and accept-invitation. The
// parent owns what each action does (they differ per Clerk flow); this only
// collects the six digits and shows the one-sentence result.
const slotClass =
  "size-12 text-lg font-semibold tabular-nums border-border-strong bg-background text-ink first:rounded-l-[10px] last:rounded-r-[10px] data-[active=true]:border-primary data-[active=true]:ring-focus-ring";

export function CodeStep({
  email,
  busy,
  onVerify,
  onResend,
  onBack,
  backLabel,
}: {
  email: string;
  busy: boolean;
  onVerify: (code: string) => Promise<SignInOutcome>;
  onResend: () => Promise<SignInOutcome>;
  onBack: () => void;
  backLabel: string;
}) {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [working, setWorking] = useState(false);
  const disabled = busy || working;

  async function verify(value: string) {
    if (disabled) return;
    setWorking(true);
    setNotice(undefined);
    try {
      const outcome = await onVerify(value);
      setMessage(outcome.ok ? undefined : outcome.message);
      if (!outcome.ok) setCode("");
    } catch {
      setMessage("The code could not be checked. Refresh the page and try again.");
    } finally {
      setWorking(false);
    }
  }

  async function resend() {
    if (disabled) return;
    setWorking(true);
    setMessage(undefined);
    setNotice(undefined);
    try {
      const outcome = await onResend();
      if (outcome.ok) {
        setCode("");
        setNotice("A new code is on its way.");
      } else {
        setMessage(outcome.message);
      }
    } catch {
      setMessage("A new code could not be sent. Refresh the page and try again.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <form
      className="grid gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void verify(code);
      }}
    >
      <div className="flex items-start gap-3 rounded-xl border border-info-border bg-info-tint px-4 py-3 text-sm leading-[1.6] text-info-text">
        <MailCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p>
          We sent a 6-digit code to <span className="font-semibold break-all">{email}</span>.
          It can take a minute to arrive.
        </p>
      </div>
      {message && (
        <p
          role="alert"
          className="rounded-xl border border-error-border bg-error-tint px-4 py-3 text-sm leading-[1.6] text-error-text"
        >
          {message}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-copy-muted">
          {notice}
        </p>
      )}
      <div className="grid gap-2">
        <label htmlFor="sign-in-code" className="text-sm font-semibold">
          Verification code
        </label>
        <InputOTP
          id="sign-in-code"
          maxLength={6}
          pattern={REGEXP_ONLY_DIGITS}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          value={code}
          disabled={disabled}
          onChange={setCode}
          onComplete={(value) => void verify(value)}
          aria-invalid={message ? true : undefined}
        >
          <InputOTPGroup className="gap-2">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <InputOTPSlot
                key={index}
                index={index}
                className={cn(slotClass, "rounded-[10px] border")}
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      <Button
        type="submit"
        size="lg"
        disabled={disabled || code.length !== 6}
        className={cn(primaryAction, "disabled:opacity-60")}
      >
        {working ? "Checking code" : "Verify code"}
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          onClick={() => void resend()}
          className={cn("h-9 px-2 font-semibold text-primary", focusStyle)}
        >
          Send a new code
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          onClick={onBack}
          className={cn("h-9 px-2 text-copy-muted", focusStyle)}
        >
          {backLabel}
        </Button>
      </div>
    </form>
  );
}
