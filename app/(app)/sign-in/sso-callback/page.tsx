"use client";

import { useRouter } from "next/navigation";
import { HandleSSOCallback } from "@clerk/nextjs";
import { afterSignInPath } from "@/lib/auth/sign-in-flow";

// Where Google sends the browser back to. Clerk finishes the sign-in here. If
// the Google account has no account in Dugtong (invite-only), the person goes
// back to the sign-in screen with a message.
export default function SsoCallbackPage() {
  const router = useRouter();

  // Always a full page load, never a client-side router push. The browser keeps
  // visited pages in memory across a sign-out and sign-in, and "/after-sign-in"
  // answers differently for each role. A push could replay the previous
  // person's answer (a student sent to /supervisor) and leave their pages in
  // memory. A fresh load starts clean.
  function go(url: string) {
    window.location.assign(url);
  }

  return (
    <HandleSSOCallback
      navigateToApp={({ decorateUrl }) => go(decorateUrl(afterSignInPath))}
      navigateToSignIn={() => router.push("/sign-in")}
      navigateToSignUp={() => router.push("/sign-in?reason=no-account")}
    />
  );
}
