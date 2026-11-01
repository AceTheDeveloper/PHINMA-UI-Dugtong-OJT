import type { ErrorCode } from "@/lib/result";

// The only pages a signed-out visitor may open. Branding assets are static
// files and are skipped by the proxy matcher. Adding a path here is a security
// decision: a test fails until the list in tests/auth/routes.test.ts matches.
export const publicPaths = ["/", "/sign-in", "/accept-invitation"] as const;

export function isPublicPath(pathname: string): boolean {
  return publicPaths.some((path) =>
    path === "/"
      ? pathname === "/"
      : pathname === path || pathname.startsWith(`${path}/`),
  );
}

// Where a page sends someone whose access check failed. Null means the
// failure is a plain "not allowed here" and the page should show not found.
export function redirectFor(code: ErrorCode): string | null {
  switch (code) {
    case "unauthenticated":
      return "/sign-in";
    case "not_provisioned":
      return "/no-access";
    case "google_required":
      return "/no-access?reason=google";
    case "inactive":
      return "/deactivated";
    case "consent_required":
      return "/consent";
    default:
      return null;
  }
}
