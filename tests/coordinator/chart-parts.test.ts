import { describe, expect, it } from "vitest";
import { hoursLabel, niceMax } from "@/components/coordinator/charts/chart-parts";

describe("hoursLabel", () => {
  it.each([
    [0, "0 h"],
    [8, "8 h"],
    [486.05, "486.1 h"],
    [999, "999 h"],
    [1000, "1,000 h"],
    [2286, "2,286 h"],
    [1234567, "1,234,567 h"],
    [1234.5, "1,234.5 h"],
  ])("writes %s as %s", (value, text) => {
    expect(hoursLabel(value)).toBe(text);
  });
});

describe("niceMax", () => {
  it.each([
    [0, 1],
    [1, 1],
    [1.5, 2],
    [2, 2],
    [3, 5],
    [5, 5],
    [6, 10],
    [11, 20],
    [171, 200],
    [201, 500],
    [999, 1000],
  ])("rounds %s up to the clean top %s", (value, top) => {
    expect(niceMax(value)).toBe(top);
  });
});
