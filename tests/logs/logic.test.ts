import { describe, expect, it } from "vitest";
import {
  endInstant,
  formatClock,
  formatDuration,
  formatLogDate,
  instantOf,
  isoWeekday,
  todayView,
  workedMinutes,
} from "@/lib/logs/logic";
import type { LogEntry } from "@/lib/logs/types";

const entry = (over: Partial<LogEntry> = {}): LogEntry => ({
  id: "log-1",
  logDate: "2026-11-02",
  timeIn: "2026-11-02T00:02:00Z", // 8:02 AM in Manila
  timeOut: null,
  status: "open",
  journal: null,
  rejectReason: null,
  earlyOutReason: null,
  breakMinutes: 0,
  scheduleStart: "08:00",
  scheduleEnd: "17:00",
  companyName: "Acme",
  ...over,
});

describe("clock and date formatting", () => {
  it("shows a timestamp in school time", () => {
    expect(formatClock("2026-11-02T00:02:00Z")).toBe("8:02 AM");
    expect(formatClock("2026-11-02T09:30:00Z")).toBe("5:30 PM");
  });

  it("shows a school date", () => {
    expect(formatLogDate("2026-11-02")).toBe("Mon, Nov 2");
  });

  it("finds the ISO weekday", () => {
    expect(isoWeekday("2026-11-02")).toBe(1);
    expect(isoWeekday("2026-11-08")).toBe(7);
  });

  it("turns a school clock time into an instant, with an optional next day", () => {
    expect(instantOf("2026-11-02", "08:00")).toBe("2026-11-02T00:00:00.000Z");
    expect(instantOf("2026-11-02", "06:00:00", 1)).toBe("2026-11-02T22:00:00.000Z");
  });
});

describe("worked time", () => {
  it("is the time between in and out, less the break", () => {
    const out = entry({ timeOut: "2026-11-02T09:05:00Z", breakMinutes: 60 });
    expect(workedMinutes(out)).toBe(9 * 60 + 3 - 60);
  });

  it("is zero while open, and never negative", () => {
    expect(workedMinutes(entry())).toBe(0);
    expect(workedMinutes(entry({ timeOut: "2026-11-02T00:10:00Z", breakMinutes: 60 }))).toBe(0);
  });

  it.each([
    [0, "0 min"],
    [45, "45 min"],
    [120, "2 h"],
    [483, "8 h 3 min"],
  ])("writes %i minutes as %s", (minutes, text) => {
    expect(formatDuration(minutes)).toBe(text);
  });
});

describe("endInstant", () => {
  it("is the scheduled end on the log date", () => {
    expect(endInstant(entry())).toBe("2026-11-02T09:00:00.000Z");
  });

  it("is the next day for a night shift", () => {
    expect(endInstant(entry({ scheduleStart: "22:00", scheduleEnd: "06:00" }))).toBe(
      "2026-11-02T22:00:00.000Z",
    );
  });

  it("is null for an entry with no schedule snapshot", () => {
    expect(endInstant(entry({ scheduleStart: null, scheduleEnd: null }))).toBeNull();
  });
});

describe("todayView", () => {
  const day = { weekday: 1, start: "08:00", end: "17:00" };
  const base = {
    today: "2026-11-02",
    hasDeployment: true,
    hasSchedule: true,
    day,
    entry: null,
    windowMinutes: 30,
  };
  // 7:29, 7:30, 12:00, 17:00, and 17:01 in Manila.
  const at = (clockTime: string) => new Date(`2026-11-02T${clockTime}:00+08:00`);

  it("offers nothing when the student has no deployment", () => {
    expect(todayView({ ...base, now: at("12:00"), hasDeployment: false })).toEqual({ kind: "none" });
  });

  it("says when there is no schedule yet, and on a day off", () => {
    expect(todayView({ ...base, now: at("12:00"), hasSchedule: false, day: null }).kind).toBe(
      "no_schedule",
    );
    expect(todayView({ ...base, now: at("12:00"), day: null }).kind).toBe("off_day");
  });

  it("opens 30 minutes before the start", () => {
    expect(todayView({ ...base, now: at("07:29") })).toEqual({ kind: "too_early", opensAt: "7:30 AM" });
    expect(todayView({ ...base, now: at("07:30") }).kind).toBe("ready");
  });

  it("follows the window setting", () => {
    expect(todayView({ ...base, now: at("07:00"), windowMinutes: 60 }).kind).toBe("ready");
    expect(todayView({ ...base, now: at("07:59"), windowMinutes: 0 }).kind).toBe("too_early");
  });

  it("is ready through the scheduled end, then ended", () => {
    expect(todayView({ ...base, now: at("12:00") })).toEqual({
      kind: "ready",
      scheduleLabel: "8:00 AM to 5:00 PM",
    });
    expect(todayView({ ...base, now: at("17:00") }).kind).toBe("ready");
    expect(todayView({ ...base, now: at("17:01") }).kind).toBe("ended");
  });

  it("handles a night shift that ends the next day", () => {
    const night = { weekday: 1, start: "22:00", end: "06:00" };
    expect(todayView({ ...base, day: night, now: at("21:30") }).kind).toBe("ready");
    expect(todayView({ ...base, day: night, now: at("12:00") }).kind).toBe("too_early");
  });

  it("shows today's entry whatever else is true", () => {
    const view = todayView({ ...base, now: at("17:30"), entry: entry(), hasSchedule: false, day: null });
    expect(view).toMatchObject({
      kind: "entry",
      scheduledEndAt: "2026-11-02T09:00:00.000Z",
      scheduledEndLabel: "5:00 PM",
    });
  });
});
