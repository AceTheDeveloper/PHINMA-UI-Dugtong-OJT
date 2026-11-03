import { describe, expect, it } from "vitest";
import { isLandingOnly } from "@/lib/landing-only";

describe("landing-only build", () => {
  it("is always on, so the landing page hides the Sign in buttons", () => {
    expect(isLandingOnly()).toBe(true);
  });
});
