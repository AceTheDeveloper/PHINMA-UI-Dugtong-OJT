import { describe, expect, it } from "vitest";
import {
  describeSchedule,
  formatTime,
  manilaToday,
  scheduleInForce,
  summarizeSchedule,
  upcomingSchedules,
} from "@/lib/schedules/logic";
import type { WorkSchedule } from "@/lib/schedules/types";

const day = (weekday: number, start = "08:00", end = "17:00") => ({ weekday, start, end });
const schedule = (id: string, effectiveFrom: string): WorkSchedule => ({
  id,
  effectiveFrom,
  days: [day(1)],
});

describe("manilaToday", () => {
  it("uses the Manila date, not UTC", () => {
    // 17:30 UTC on 1 Nov is already 2 Nov in Manila.
    expect(manilaToday(new Date("2026-11-01T17:30:00Z"))).toBe("2026-11-02");
    expect(manilaToday(new Date("2026-11-01T15:59:00Z"))).toBe("2026-11-01");
  });
});

describe("scheduleInForce", () => {
  const list = [schedule("a", "2026-11-01"), schedule("b", "2026-11-10"), schedule("c", "2026-12-01")];

  it("picks the newest schedule that has started", () => {
    expect(scheduleInForce(list, "2026-11-15")?.id).toBe("b");
  });

  it("counts a schedule that starts today", () => {
    expect(scheduleInForce(list, "2026-11-10")?.id).toBe("b");
  });

  it("is null before any schedule starts, and for none", () => {
    expect(scheduleInForce(list, "2026-10-31")).toBeNull();
    expect(scheduleInForce([], "2026-11-15")).toBeNull();
  });
});

describe("upcomingSchedules", () => {
  it("lists only schedules after today, soonest first", () => {
    const list = [schedule("c", "2026-12-01"), schedule("a", "2026-11-01"), schedule("b", "2026-11-20")];
    expect(upcomingSchedules(list, "2026-11-10").map((item) => item.id)).toEqual(["b", "c"]);
  });
});

describe("formatTime", () => {
  it.each([
    ["00:00", "12:00 AM"],
    ["08:05", "8:05 AM"],
    ["12:00", "12:00 PM"],
    ["17:00", "5:00 PM"],
    ["23:59", "11:59 PM"],
  ])("%s is %s", (input, expected) => {
    expect(formatTime(input)).toBe(expected);
  });
});

describe("describeSchedule", () => {
  it("collapses a run of days with the same hours", () => {
    expect(describeSchedule([1, 2, 3, 4, 5].map((weekday) => day(weekday)))).toEqual([
      { days: "Mon to Fri", times: "8:00 AM to 5:00 PM" },
    ]);
  });

  it("lists two days or a gap by name", () => {
    expect(describeSchedule([day(1), day(2), day(4)])[0].days).toBe("Mon, Tue, Thu");
  });

  it("splits days with different hours, earliest weekday first", () => {
    const lines = describeSchedule([day(6, "09:00", "13:00"), day(1), day(2), day(3)]);
    expect(lines.map((line) => line.days)).toEqual(["Mon to Wed", "Sat"]);
  });

  it("says when a night shift ends the next day", () => {
    expect(describeSchedule([day(5, "22:00", "06:00")])[0].times).toBe(
      "10:00 PM to 6:00 AM (next day)",
    );
  });

  it("summarizes in one line", () => {
    expect(summarizeSchedule([day(1), day(2), day(3), day(6, "09:00", "13:00")])).toBe(
      "Mon to Wed, 8:00 AM to 5:00 PM; Sat, 9:00 AM to 1:00 PM",
    );
  });
});
