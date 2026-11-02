import type { ScheduleDay, WorkSchedule } from "@/lib/schedules/types";

// Pure helpers for schedules. No database and no clock of their own: callers
// pass today's date, so the results are easy to test.

export const weekdayNames = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const shortNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const manilaDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Today's date in the school timezone, as YYYY-MM-DD.
export function manilaToday(now: Date = new Date()): string {
  return manilaDate.format(now);
}

// The schedule in force on a date: the newest one that has started. Null when
// none has started yet.
export function scheduleInForce(
  schedules: readonly WorkSchedule[],
  today: string,
): WorkSchedule | null {
  const started = schedules.filter((schedule) => schedule.effectiveFrom <= today);
  if (started.length === 0) return null;
  return started.reduce((newest, item) =>
    item.effectiveFrom > newest.effectiveFrom ? item : newest,
  );
}

// Schedules that start after today, soonest first.
export function upcomingSchedules(
  schedules: readonly WorkSchedule[],
  today: string,
): WorkSchedule[] {
  return schedules
    .filter((schedule) => schedule.effectiveFrom > today)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
}

// "08:00" becomes "8:00 AM".
export function formatTime(value: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelve}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function isNightShift(day: ScheduleDay): boolean {
  return day.end < day.start;
}

function rangeLabel(weekdays: number[]): string {
  const sorted = [...weekdays].sort((a, b) => a - b);
  const parts: string[] = [];
  let index = 0;
  while (index < sorted.length) {
    let last = index;
    while (last + 1 < sorted.length && sorted[last + 1] === sorted[last] + 1) last += 1;
    const from = shortNames[sorted[index] - 1];
    const to = shortNames[sorted[last] - 1];
    if (last - index >= 2) parts.push(`${from} to ${to}`);
    else for (let step = index; step <= last; step += 1) parts.push(shortNames[sorted[step] - 1]);
    index = last + 1;
  }
  return parts.join(", ");
}

export type ScheduleLine = { days: string; times: string };

// Groups days that share the same hours: "Mon to Fri" and "8:00 AM to 5:00 PM".
// A night shift says so, since its end is on the next day.
export function describeSchedule(days: readonly ScheduleDay[]): ScheduleLine[] {
  const groups = new Map<string, { weekdays: number[]; day: ScheduleDay }>();
  for (const day of days) {
    const key = `${day.start}-${day.end}`;
    const group = groups.get(key);
    if (group) group.weekdays.push(day.weekday);
    else groups.set(key, { weekdays: [day.weekday], day });
  }
  return [...groups.values()]
    .sort((a, b) => Math.min(...a.weekdays) - Math.min(...b.weekdays))
    .map(({ weekdays, day }) => ({
      days: rangeLabel(weekdays),
      times: `${formatTime(day.start)} to ${formatTime(day.end)}${isNightShift(day) ? " (next day)" : ""}`,
    }));
}

export function summarizeSchedule(days: readonly ScheduleDay[]): string {
  return describeSchedule(days)
    .map((line) => `${line.days}, ${line.times}`)
    .join("; ");
}
