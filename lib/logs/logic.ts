import { formatTime } from "@/lib/schedules/logic";
import type { ScheduleDay } from "@/lib/schedules/types";
import type { LogEntry, TodayView } from "@/lib/logs/types";

// Pure helpers for the student's daily log. The database decides every rule;
// these only decide what to show, so the screen can say why Time in is not
// available. They take the clock as a parameter and never read it themselves.
//
// Manila has no daylight saving time, so a school date and clock time become an
// instant with a fixed +08:00 offset. This is for display only.

const manilaOffset = "+08:00";

const clockFormat = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const dayFormat = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  weekday: "short",
  month: "short",
  day: "numeric",
});

// "8:02 AM" for a timestamp, in school time.
export function formatClock(iso: string): string {
  return clockFormat.format(new Date(iso)).replace(/\s?([ap])m$/i, (_, letter: string) =>
    ` ${letter.toUpperCase()}M`,
  );
}

// "Mon, Nov 2" for a school date.
export function formatLogDate(date: string): string {
  return dayFormat.format(new Date(`${date}T12:00:00${manilaOffset}`));
}

// The moment a clock time on a school date happens, as an ISO string.
export function instantOf(date: string, time: string, addDays = 0): string {
  const base = new Date(`${date}T${time.slice(0, 5)}:00${manilaOffset}`);
  base.setUTCDate(base.getUTCDate() + addDays);
  return base.toISOString();
}

// Monday is 1, Sunday is 7.
export function isoWeekday(date: string): number {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

// Minutes between time in and time out, less the break, never below zero.
export function workedMinutes(entry: Pick<LogEntry, "timeIn" | "timeOut" | "breakMinutes">): number {
  if (!entry.timeOut) return 0;
  const minutes = (Date.parse(entry.timeOut) - Date.parse(entry.timeIn)) / 60000;
  return Math.max(0, Math.floor(minutes) - entry.breakMinutes);
}

// "8 h 3 min", "45 min", "2 h".
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function endInstant(entry: Pick<LogEntry, "logDate" | "scheduleStart" | "scheduleEnd">): string | null {
  if (!entry.scheduleEnd || !entry.scheduleStart) return null;
  return instantOf(entry.logDate, entry.scheduleEnd, entry.scheduleEnd < entry.scheduleStart ? 1 : 0);
}

type TodayInput = {
  now: Date;
  today: string;
  hasDeployment: boolean;
  // Whether a schedule has started, and today's day in it (null on a day off).
  hasSchedule: boolean;
  day: ScheduleDay | null;
  entry: LogEntry | null;
  windowMinutes: number;
};

// What the Today panel should offer right now.
export function todayView(input: TodayInput): TodayView {
  const { now, today, entry } = input;
  if (entry) {
    const scheduledEndAt = endInstant(entry);
    return {
      kind: "entry",
      entry,
      scheduledEndAt,
      scheduledEndLabel: entry.scheduleEnd ? formatTime(entry.scheduleEnd) : null,
    };
  }
  if (!input.hasDeployment) return { kind: "none" };
  if (!input.hasSchedule) return { kind: "no_schedule" };
  if (!input.day) return { kind: "off_day" };

  const { day } = input;
  const opens = Date.parse(instantOf(today, day.start)) - input.windowMinutes * 60000;
  const ends = Date.parse(instantOf(today, day.end, day.end < day.start ? 1 : 0));
  const label = `${formatTime(day.start)} to ${formatTime(day.end)}`;
  if (now.getTime() < opens) {
    return { kind: "too_early", opensAt: formatClock(new Date(opens).toISOString()) };
  }
  if (now.getTime() > ends) return { kind: "ended" };
  return { kind: "ready", scheduleLabel: label };
}

const clockParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Manila",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// "08:02", the value for a time input, for a timestamp in school time.
export function clockValue(iso: string): string {
  return clockParts.format(new Date(iso));
}
