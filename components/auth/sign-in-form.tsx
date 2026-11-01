"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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
import { cn } from "@/lib/utils";

// Mock behavior: submitting only moves to the next screen. Real sign-in with
// Clerk, and form validation, arrive in ticket-09.
export function SignInForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push("/consent");
  }

  return (
    <div>
      <GoogleButton />
      <OrDivider>or sign in with email</OrDivider>
      <form onSubmit={handleSubmit} className="grid gap-5">
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
        <Field
          id="password"
          label="Password"
          aside={
            <button
              type="button"
              className={cn(
                "text-sm font-semibold text-primary-hover",
                focusStyle,
              )}
            >
              Forgot password?
            </button>
          }
        >
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
        <Button type="submit" size="lg" className={primaryAction}>
          Sign in
        </Button>
      </form>
    </div>
  );
}
