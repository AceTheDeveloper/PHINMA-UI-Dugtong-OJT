// Landing-only mode: while the app is under development, the hosted site can
// serve just the public landing page. Set LANDING_ONLY=true on that deployment
// only. Leave it unset locally and on every other environment.
export function isLandingOnly(): boolean {
  return process.env.LANDING_ONLY === "true";
}

// In landing-only mode every path except the landing page itself is closed.
export function isClosedInLandingOnly(pathname: string): boolean {
  return pathname !== "/";
}
