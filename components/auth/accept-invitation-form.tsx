"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";
import { Eye, EyeOff } from "lucide-react";
import {
  authInput,
  Field,
  GoogleButton,
  OrDivider,
  primaryAction,
} from "@/components/auth/auth-parts";
import { CodeStep } from "@/components/auth/code-step";
import { focusStyle } from "@/components/brand-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  acceptWithGoogle,
  acceptWithPassword,
  resendSignUpCode,
  startInvitation,
  verifySignUpCode,
} from "@/lib/auth/accept-invitation-flow";
import { cn } from "@/lib/utils";

// Our own accept-invitation form on Clerk's sign-up object. Clerk puts the
// invitation in the link (__clerk_ticket). The invited email is shown and
// cannot be changed: the account is created for that address.

type Start =
  | { state: "checking" }
  | { state: "invalid"; message: string }
  | { state: "ready"; email: string };

function Message({ children }: { children: string }) {
  return (
    <p
      role="alert"
      className="rounded-xl border border-error-border bg-error-tint px-4 py-3 text-sm leading-[1.6] text-error-text"
    >
      {children}
    </p>
  );
}

function SignInLink() {
  return (
    <Link
      href="/sign-in"
      className={cn(
        "inline-flex h-12 w-full items-center justify-center rounded-[10px] border border-border-strong bg-card px-5 text-[15px] font-semibold text-ink hover:bg-surface",
        focusStyle,
      )}
    >
      Go to sign in
    </Link>
  );
}

function InvitationForm() {
  const params = useSearchParams();
  const { signUp, fetchStatus } = useSignUp();
  const [start, setStart] = useState<Start>({ state: "checking" });
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [codeStep, setCodeStep] = useState(false);
  const started = useRef(false);
  const busy = fetchStatus === "fetching";

  const ticket = params.get("__clerk_ticket");
  const hasAccount = params.get("__clerk_status") === "sign_in";

  // Always a full page load, never a client-side router push. The browser keeps
  // visited pages in memory across a sign-out and sign-in, and "/after-sign-in"
  // answers differently for each role. A push could replay the previous
  // person's answer (a student sent to /supervisor) and leave their pages in
  // memory. A fresh load starts clean.
  function go(url: string) {
    window.location.assign(url);
  }

  // Once per page load: Clerk would otherwise open a second sign-up attempt.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (hasAccount) return;
    startInvitation(signUp, ticket)
      .then((outcome) =>
        setStart(
          outcome.ok
            ? { state: "ready", email: outcome.email }
            : { state: "invalid", message: outcome.message },
        ),
      )
      .catch(() =>
        setStart({
          state: "invalid",
          message: "The invitation could not be checked. Refresh the page and try again.",
        }),
      );
  }, [signUp, ticket, hasAccount]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const outcome = await acceptWithPassword(
        signUp,
        String(form.get("password") ?? ""),
        go,
      );
      setMessage(outcome.ok ? undefined : outcome.message);
      if (outcome.ok && outcome.step === "email_code") setCodeStep(true);
    } catch {
      setMessage("The account could not be created. Refresh the page and try again.");
    }
  }

  async function handleGoogle() {
    try {
      const outcome = await acceptWithGoogle(signUp);
      setMessage(outcome.ok ? undefined : outcome.message);
    } catch {
      setMessage("Google sign-up did not start. Refresh the page and try again.");
    }
  }

  // The link says this email already has an account: nothing to accept.
  if (hasAccount) {
    return (
      <div className="grid gap-5">
        <p className="text-sm leading-[1.6] text-copy-muted">
          You already have an account. Sign in to continue.
        </p>
        <SignInLink />
      </div>
    );
  }

  if (start.state === "checking") {
    return (
      <p role="status" className="text-sm text-copy-muted">
        Checking your invitation
      </p>
    );
  }

  if (start.state === "invalid") {
    return (
      <div className="grid gap-5">
        <Message>{start.message}</Message>
        <SignInLink />
      </div>
    );
  }

  if (codeStep) {
    return (
      <CodeStep
        email={start.email}
        busy={busy}
        onVerify={(code) => verifySignUpCode(signUp, code, go)}
        onResend={() => resendSignUpCode(signUp)}
        onBack={() => setCodeStep(false)}
        backLabel="Back to password"
      />
    );
  }

  return (
    <div>
      <GoogleButton onClick={handleGoogle} disabled={busy} />
      <OrDivider>or create a password</OrDivider>
      <form onSubmit={handleSubmit} className="grid gap-5" noValidate>
        {message && <Message>{message}</Message>}
        <Field id="email" label="Invited email">
          <Input
            id="email"
            name="email"
            type="email"
            value={start.email}
            readOnly
            autoComplete="username"
            className={cn(authInput, "bg-surface text-copy-muted")}
          />
        </Field>
        <Field id="password" label="Password">
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Create a password"
              className={cn(authInput, "pr-12")}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((current) => !current)}
              className={cn("absolute right-1.5 top-1.5 size-9", focusStyle)}
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        </Field>
        <Button
          type="submit"
          size="lg"
          disabled={busy}
          className={cn(primaryAction, "disabled:opacity-60")}
        >
          {busy ? "Creating account" : "Create account"}
        </Button>
      </form>
    </div>
  );
}

export function AcceptInvitationForm() {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-copy-muted">
          Checking your invitation
        </p>
      }
    >
      <InvitationForm />
    </Suspense>
  );
}
