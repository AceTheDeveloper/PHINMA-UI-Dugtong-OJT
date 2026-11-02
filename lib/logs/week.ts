import { formatDuration, formatLogDate, isoWeekday, workedMinutes } from "@/lib/logs/logic";
import type { LogEntry } from "@/lib/logs/types";

// The student's week as seven stamped days, and the daily log grouped by week. Pure:
// they take the entries and the schedule's working days and decide what each day
// shows. A week runs Monday to Sunday, in school dates (YYYY-MM-DD).

export type WeekDayState =
  | "approved"
  | "pending"
  | "open"
  | "rejected"
  | "missed"
  | "today"
  | "upcoming"
  | "off";

export type WeekDay = {
  date: string;
  letter: string;
  dayOfMonth: number;
  state: WeekDayState;
  // Minutes worked, for a day with a finished entry; otherwise null.
  minutes: number | null;
  // What a screen reader says for the day.
  label: string;
  isToday: boolean;
};

const letters = ["M", "T", "W", "T", "F", "S", "S"] as const;

export function addDays(date: string, days: number): string {
  const moved = new Date(`${date}T12:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

export function mondayOf(date: string): string {
  return addDays(date, -(isoWeekday(date) - 1));
}

// The seven dates of the week that holds `date`, Monday first.
export function weekDates(date: string): string[] {
  const monday = mondayOf(date);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

type WeekEntry = Pick<LogEntry, "logDate" | "status" | "timeIn" | "timeOut" | "breakMinutes">;

const phrases: Record<WeekDayState, string> = {
  approved: "approved",
  pending: "waiting for your supervisor",
  open: "timed in",
  rejected: "sent back to you",
  missed: "no entry",
  today: "today, not timed in yet",
  upcoming: "coming up",
  off: "not a working day",
};

export function buildWeek(input: {
  today: string;
  entries: readonly WeekEntry[];
  // Whether a date is a working day under the schedule in force on that date.
  isWorkday: (date: string) => boolean;
}): { days: WeekDay[]; approvedMinutes: number } {
  const byDate = new Map(input.entries.map((entry) => [entry.logDate, entry]));
  let approvedMinutes = 0;

  const days = weekDates(input.today).map((date, index): WeekDay => {
    const entry = byDate.get(date);
    const working = input.isWorkday(date);
    let state: WeekDayState;
    if (entry) {
      state = entry.status;
    } else if (!working) {
      state = "off";
    } else if (date === input.today) {
      state = "today";
    } else {
      state = date > input.today ? "upcoming" : "missed";
    }

    const finished = entry && (state === "approved" || state === "pending" || state === "rejected");
    const minutes = finished && entry.timeOut ? workedMinutes(entry) : null;
    if (state === "approved" && minutes !== null) approvedMinutes += minutes;

    const detail =
      state === "approved" && minutes !== null
        ? `approved, ${formatDuration(minutes)}`
        : phrases[state];
    return {
      date,
      letter: letters[index],
      dayOfMonth: Number(date.slice(8, 10)),
      state,
      minutes,
      label: `${formatLogDate(date)}: ${detail}`,
      isToday: date === input.today,
    };
  });

  return { days, approvedMinutes };
}

export type WeekGroup = {
  weekStart: string;
  label: string;
  entries: LogEntry[];
  approvedMinutes: number;
  pendingCount: number;
};

const monthDay = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" });
const monthDayYear = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function inSchool(date: string): Date {
  return new Date(`${date}T12:00:00+08:00`);
}

// "Nov 2 to Nov 8, 2026" for the week starting on a Monday.
export function weekLabel(weekStart: string): string {
  return `${monthDay.format(inSchool(weekStart))} to ${monthDayYear.format(inSchool(addDays(weekStart, 6)))}`;
}

// The entries grouped by the week they fall in, the newest week first. Within a
// week the entries keep the order they came in (newest day first).
export function groupByWeek(entries: readonly LogEntry[]): WeekGroup[] {
  const groups = new Map<string, WeekGroup>();
  for (const entry of entries) {
    const weekStart = mondayOf(entry.logDate);
    let group = groups.get(weekStart);
    if (!group) {
      group = { weekStart, label: weekLabel(weekStart), entries: [], approvedMinutes: 0, pendingCount: 0 };
      groups.set(weekStart, group);
    }
    group.entries.push(entry);
    if (entry.status === "approved") group.approvedMinutes += workedMinutes(entry);
    if (entry.status === "pending") group.pendingCount += 1;
  }
  return [...groups.values()].sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}
