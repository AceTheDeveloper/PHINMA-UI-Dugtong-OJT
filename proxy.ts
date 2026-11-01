import { clerkMiddleware } from "@clerk/nextjs/server";
import { isPublicPath } from "@/lib/auth/routes";

// The proxy only turns signed-out visitors away from non-public pages. Real
// authorization (role, scope, active state, consent) happens next to the data,
// in layouts, server actions, and route handlers through lib/auth/server.ts.
export default clerkMiddleware(
  async (auth, request) => {
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
