"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";
import { Eye, EyeOff } from "lucide-react";
import {
  authInput,
  Field,
  GoogleButton,
  OrDivider,
  primaryAction,
} from "@/components/auth/auth-parts";
import { focusStyle } from "@/components/brand-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInWithGoogle, signInWithPassword } from "@/lib/auth/sign-in-flow";
import { cn } from "@/lib/utils";

export function SignInForm({ notice }: { notice?: string }) {
  const router = useRouter();
  const { signIn, fetchStatus } = useSignIn();
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | undefined>(notice);
  const busy = fetchStatus === "fetching";

  // Decorated URLs can be absolute (they refresh the session cookie on Safari).
  function go(url: string) {
    if (url.startsWith("http")) {
      window.location.href = url;
    } else {
      router.push(url);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const outcome = await signInWithPassword(
        signIn,
        {
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
        },
        go,
      );
      setMessage(outcome.ok ? undefined : outcome.message);
    } catch {
      setMessage("Sign-in did not work. Refresh the page and try again.");
    }
  }

  async function handleGoogle() {
    try {
      const outcome = await signInWithGoogle(signIn);
      setMessage(outcome.ok ? undefined : outcome.message);
    } catch {
      setMessage("Google sign-in did not start. Refresh the page and try again.");
    }
  }

  return (
    <div>
      <GoogleButton onClick={handleGoogle} disabled={busy} />
      <OrDivider>or sign in with email</OrDivider>
      <form onSubmit={handleSubmit} className="grid gap-5" noValidate>
        {message && (
          <p
            role="alert"
            className="rounded-xl border border-error-border bg-error-tint px-4 py-3 text-sm leading-[1.6] text-error-text"
          >
            {message}
          </p>
        )}
        <Field id="email" label="Email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
            className={authInput}
          />
        </Field>
        <Field id="password" label="Password">
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
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
          {busy ? "Signing in" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
