import { Suspense } from "react";
import { ClerkProvider } from "@clerk/nextjs";

// Clerk reads the request (cookies), so with Cache Components it must sit in a
// Suspense boundary. It lives here, not in the root layout, so the public
// landing page stays prerendered. Every page in this group is signed-in or
// sign-in related and is rendered per request.
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-page-wash" />}>
      <ClerkProvider signInUrl="/sign-in" afterSignOutUrl="/sign-in">
        {children}
      </ClerkProvider>
    </Suspense>
  );
}
