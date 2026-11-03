// This branch ships only the public landing page: there is no sign-in or app
// behind it, so landing-only mode is always on and the Sign in buttons stay
// hidden. The full app (on dev) reads LANDING_ONLY from the environment instead.
export function isLandingOnly(): boolean {
  return true;
}
