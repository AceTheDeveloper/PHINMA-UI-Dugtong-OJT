"use client";

import { useRouter } from "next/navigation";
import { HandleSSOCallback } from "@clerk/nextjs";
import { afterSignInPath } from "@/lib/auth/sign-in-flow";

// Where Google sends the browser back to. Clerk finishes the sign-in here. If
// the Google account has no account in Dugtong (invite-only), the person goes
// back to the sign-in screen with a message.
export default function SsoCallbackPage() {
  const router = useRouter();

  function go(url: string) {
    if (url.startsWith("http")) {
      window.location.href = url;
    } else {
      router.push(url);
    }
  }

  return (
    <HandleSSOCallback
      navigateToApp={({ decorateUrl }) => go(decorateUrl(afterSignInPath))}
      navigateToSignIn={() => router.push("/sign-in")}
      navigateToSignUp={() => router.push("/sign-in?reason=no-account")}
    />
  );
}
