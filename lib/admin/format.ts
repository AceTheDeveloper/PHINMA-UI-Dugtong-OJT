// Dates on the Admin screens are shown in Asia/Manila, the school's timezone,
// whatever the browser or server timezone is.

const dateTime = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  dateStyle: "medium",
  timeStyle: "short",
});

const dateOnly = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  dateStyle: "medium",
});

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

export function formatDate(iso: string): string {
  return dateOnly.format(new Date(iso));
}

// A date-only value such as 2027-05-01 has no time, so format it as written.
export function formatPlainDate(value: string | null): string {
  if (!value) return "Not set";
  return dateOnly.format(new Date(`${value}T00:00:00+08:00`));
}

export function formatHours(hours: number): string {
  return `${Number.isInteger(hours) ? hours : hours.toFixed(2)} h`;
}
