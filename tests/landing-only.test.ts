import { afterEach, describe, expect, it, vi } from "vitest";
import { isClosedInLandingOnly, isLandingOnly } from "@/lib/landing-only";

describe("landing-only mode", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is off unless LANDING_ONLY is exactly true", () => {
    expect(isLandingOnly()).toBe(false);
    vi.stubEnv("LANDING_ONLY", "false");
    expect(isLandingOnly()).toBe(false);
    vi.stubEnv("LANDING_ONLY", "true");
    expect(isLandingOnly()).toBe(true);
  });

  it.each([
    ["/", false],
    ["/sign-in", true],
    ["/sign-in/sso-callback", true],
    ["/accept-invitation", true],
    ["/student", true],
    ["/admin", true],
    ["/api/anything", true],
  ])("closes %s: %s", (path, closed) => {
    expect(isClosedInLandingOnly(path)).toBe(closed);
  });
});
