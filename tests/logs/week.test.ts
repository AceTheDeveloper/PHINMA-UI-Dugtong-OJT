import { describe, expect, it } from "vitest";
import { addDays, buildWeek, groupByWeek, mondayOf, weekDates, weekLabel } from "@/lib/logs/week";
import type { LogEntry } from "@/lib/logs/types";

// 2026-11-03 is a Tuesday. Its week runs Monday 2 Nov to Sunday 8 Nov.
const today = "2026-11-03";
const workdays = (date: string) => {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day >= 1 && day <= 5;
};

function entry(logDate: string, status: LogEntry["status"], hours = 9, breakMinutes = 0): LogEntry {
  return {
    id: `l-${logDate}`,
    logDate,
    timeIn: `${logDate}T08:00:00+08:00`,
    timeOut: status === "open" ? null : new Date(Date.parse(`${logDate}T08:00:00+08:00`) + hours * 3600000).toISOString(),
    status,
    journal: null,
    rejectReason: null,
    earlyOutReason: null,
    breakMinutes,
    scheduleStart: "08:00",
    scheduleEnd: "17:00",
    companyName: "Acme",
  };
}

describe("dates", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it.each([
    ["2026-11-02", "2026-11-02"],
    ["2026-11-03", "2026-11-02"],
    ["2026-11-08", "2026-11-02"],
    ["2026-11-09", "2026-11-09"],
    ["2027-01-01", "2026-12-28"],
  ])("puts %s in the week starting %s", (date, monday) => {
    expect(mondayOf(date)).toBe(monday);
  });

  it("lists the seven dates of a week, Monday first", () => {
    expect(weekDates(today)).toEqual([
      "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08",
    ]);
  });

  it("writes a week for a label, with the year once", () => {
    expect(weekLabel("2026-11-02")).toBe("Nov 2 to Nov 8, 2026");
    expect(weekLabel("2026-12-28")).toBe("Dec 28 to Jan 3, 2027");
  });
});

describe("buildWeek", () => {
  it("shows each day's state: stamped, waiting, today, coming up, and the weekend off", () => {
    const week = buildWeek({
      today,
      entries: [entry("2026-11-02", "approved", 9)],
      isWorkday: workdays,
    });
    expect(week.days.map((day) => [day.letter, day.state])).toEqual([
      ["M", "approved"],
      ["T", "today"],
      ["W", "upcoming"],
      ["T", "upcoming"],
      ["F", "upcoming"],
      ["S", "off"],
      ["S", "off"],
    ]);
    expect(week.days[1].isToday).toBe(true);
    expect(week.days.filter((day) => day.isToday)).toHaveLength(1);
  });

  it("marks a past working day with no entry as missed, and a past weekend as off", () => {
    const week = buildWeek({ today: "2026-11-06", entries: [], isWorkday: workdays });
    expect(week.days.map((day) => day.state)).toEqual([
      "missed", "missed", "missed", "missed", "today", "off", "off",
    ]);
  });

  it("takes an entry's own status for the day, whatever the schedule says", () => {
    const week = buildWeek({
      today: "2026-11-06",
      entries: [
        entry("2026-11-02", "approved"),
        entry("2026-11-03", "pending"),
        entry("2026-11-04", "rejected"),
        entry("2026-11-05", "open"),
        entry("2026-11-07", "approved"), // a Saturday worked, though not scheduled
      ],
      isWorkday: workdays,
    });
    expect(week.days.map((day) => day.state)).toEqual([
      "approved", "pending", "rejected", "open", "today", "approved", "off",
    ]);
  });

  it("counts only approved entries toward the week's hours, with the break taken off", () => {
    const week = buildWeek({
      today,
      entries: [entry("2026-11-02", "approved", 9, 60), entry("2026-11-03", "pending", 9)],
      isWorkday: workdays,
    });
    expect(week.approvedMinutes).toBe(8 * 60);
    expect(week.days[0].minutes).toBe(480);
    expect(week.days[1].minutes).toBe(540); // shown, but not counted
  });

  it("has no hours for a day that is open, today, or missed", () => {
    const week = buildWeek({ today: "2026-11-05", entries: [entry("2026-11-04", "open")], isWorkday: workdays });
    expect(week.days.map((day) => day.minutes)).toEqual([null, null, null, null, null, null, null]);
    expect(week.approvedMinutes).toBe(0);
  });

  it("describes each day for a screen reader", () => {
    const week = buildWeek({
      today: "2026-11-05",
      entries: [entry("2026-11-02", "approved", 9), entry("2026-11-03", "pending"), entry("2026-11-04", "rejected")],
      isWorkday: workdays,
    });
    expect(week.days.map((day) => day.label)).toEqual([
      "Mon, Nov 2: approved, 9 h",
      "Tue, Nov 3: waiting for your supervisor",
      "Wed, Nov 4: sent back to you",
      "Thu, Nov 5: today, not timed in yet",
      "Fri, Nov 6: coming up",
      "Sat, Nov 7: not a working day",
      "Sun, Nov 8: not a working day",
    ]);
  });

  it("has no working days at all before a schedule starts: every day is off", () => {
    const week = buildWeek({ today, entries: [], isWorkday: () => false });
    expect(week.days.every((day) => day.state === "off")).toBe(true);
  });

  it("reads a week that crosses a year end", () => {
    const week = buildWeek({ today: "2027-01-01", entries: [], isWorkday: workdays });
    expect(week.days[0].date).toBe("2026-12-28");
    expect(week.days[6].date).toBe("2027-01-03");
    expect(week.days.map((day) => day.dayOfMonth)).toEqual([28, 29, 30, 31, 1, 2, 3]);
  });
});

describe("groupByWeek", () => {
  const entries = [
    entry("2026-11-04", "pending"),
    entry("2026-11-03", "approved", 9),
    entry("2026-10-30", "approved", 8, 60),
    entry("2026-10-29", "rejected"),
  ];

  it("groups by week, the newest week first, entries keeping their order", () => {
    const groups = groupByWeek(entries);
    expect(groups.map((group) => group.weekStart)).toEqual(["2026-11-02", "2026-10-26"]);
    expect(groups[0].entries.map((item) => item.logDate)).toEqual(["2026-11-04", "2026-11-03"]);
    expect(groups[1].entries.map((item) => item.logDate)).toEqual(["2026-10-30", "2026-10-29"]);
  });

  it("totals only the approved hours of each week, and counts what waits", () => {
    const [latest, earlier] = groupByWeek(entries);
    expect(latest).toMatchObject({ approvedMinutes: 540, pendingCount: 1, label: "Nov 2 to Nov 8, 2026" });
    expect(earlier).toMatchObject({ approvedMinutes: 420, pendingCount: 0, label: "Oct 26 to Nov 1, 2026" });
  });

  it("is empty for no entries, and keeps a Sunday in the week it ends", () => {
    expect(groupByWeek([])).toEqual([]);
    const sunday = groupByWeek([entry("2026-11-08", "approved")]);
    expect(sunday[0].weekStart).toBe("2026-11-02");
  });
});
