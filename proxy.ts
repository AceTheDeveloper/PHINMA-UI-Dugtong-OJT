import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isPublicPath } from "@/lib/auth/routes";
import { isClosedInLandingOnly, isLandingOnly } from "@/lib/landing-only";

// The proxy only turns signed-out visitors away from non-public pages. Real
// authorization (role, scope, active state, consent) happens next to the data,
// in layouts, server actions, and route handlers through lib/auth/server.ts.
export default clerkMiddleware(
  async (auth, request) => {
    // Landing-only deployments send every other path back to the landing page.
    if (isLandingOnly() && isClosedInLandingOnly(request.nextUrl.pathname)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    if (!isPublicPath(request.nextUrl.pathname)) {
      await auth.protect();
    }
  },
  { signInUrl: "/sign-in" },
);

export const config = {
  matcher: [
    // Skip Next.js internals and static files (branding assets are public).
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
