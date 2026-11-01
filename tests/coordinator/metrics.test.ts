import { describe, expect, it } from "vitest";
import { progressPercent } from "@/lib/coordinator/metrics";

describe("progressPercent", () => {
  it("rounds approved hours against required hours", () => {
    expect(progressPercent(120, 300)).toBe(40);
  });

  it("caps at 100 when hours exceed the requirement", () => {
    expect(progressPercent(312.5, 300)).toBe(100);
  });

  it("returns 0 when required hours is not positive", () => {
    expect(progressPercent(50, 0)).toBe(0);
  });
});
