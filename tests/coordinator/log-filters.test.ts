import { describe, expect, it } from "vitest";
import {
  logFiltersHref,
  parseLogFilters,
  staleCutoff,
  type LogFilters,
} from "@/lib/coordinator/log-filters";

const id = "00000000-0000-4000-8000-0000000000a1";
const defaults: LogFilters = { status: "all", company: null, student: null, from: null, to: null, shown: 50 };

describe("parseLogFilters", () => {
  it("defaults to everything, one page", () => {
    expect(parseLogFilters({})).toEqual(defaults);
  });

  it("reads a valid address", () => {
    expect(
      parseLogFilters({ status: "stale", company: id, student: id, from: "2026-10-01", to: "2026-10-31", shown: "100" }),
    ).toEqual({ status: "stale", company: id, student: id, from: "2026-10-01", to: "2026-10-31", shown: 100 });
  });

  it("ignores an unknown status, a malformed id, and a bad date", () => {
    expect(
      parseLogFilters({ status: "deleted", company: "1; drop table", student: "nope", from: "2026-13-40", to: "yesterday" }),
    ).toEqual(defaults);
  });

  it("takes the first of a repeated value", () => {
    expect(parseLogFilters({ status: ["rejected", "approved"] }).status).toBe("rejected");
  });

  it("reads a range typed backwards the right way round", () => {
    const filters = parseLogFilters({ from: "2026-11-05", to: "2026-11-01" });
    expect([filters.from, filters.to]).toEqual(["2026-11-01", "2026-11-05"]);
  });

  it("rounds the page size up to whole pages and caps it", () => {
    expect(parseLogFilters({ shown: "75" }).shown).toBe(100);
    expect(parseLogFilters({ shown: "10" }).shown).toBe(50);
    expect(parseLogFilters({ shown: "abc" }).shown).toBe(50);
    expect(parseLogFilters({ shown: "999999" }).shown).toBe(1000);
  });
});

describe("logFiltersHref", () => {
  it("is the plain address with no filters", () => {
    expect(logFiltersHref(defaults)).toBe("/coordinator/logs");
  });

  it("keeps only what differs from the default", () => {
    expect(logFiltersHref({ ...defaults, status: "stale", company: id, shown: 100 })).toBe(
      `/coordinator/logs?status=stale&company=${id}&shown=100`,
    );
  });

  it("applies a change on top of the current filters", () => {
    expect(logFiltersHref({ ...defaults, status: "stale", shown: 100 }, { status: "all", shown: 50 })).toBe(
      "/coordinator/logs",
    );
  });
});

describe("staleCutoff", () => {
  it("is the newest date that has waited more than the threshold", () => {
    // Threshold 3, today 3 Nov: 30 Oct has waited 4 days (stale); 31 Oct has waited 3 (not).
    expect(staleCutoff("2026-11-03", 3)).toBe("2026-10-30");
  });
});
