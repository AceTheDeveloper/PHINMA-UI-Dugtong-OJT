import type { CertificateData } from "@/lib/certification/types";

// The wording of a certificate is data per course (certificate_templates). It
// holds placeholders in braces, filled from the certification's snapshot.

const monthDay = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  month: "long",
  day: "numeric",
  year: "numeric",
});

// "2026-08-18" as "August 18, 2026". A school date has no time, so it is read at
// midday Manila time to avoid any rollover.
export function longDate(date: string): string {
  return monthDay.format(new Date(`${date}T12:00:00+08:00`));
}

export function longDateOfInstant(iso: string): string {
  return monthDay.format(new Date(iso));
}

export function hoursText(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

// Replaces the known placeholders. Anything else in braces is left as written,
// so a typo in a template shows up on the page instead of vanishing.
export function fillTemplate(body: string, data: CertificateData): string {
  const values: Record<string, string> = {
    student: data.studentName,
    student_number: data.studentNumber,
    course: data.courseName,
    company: data.companyName,
    hours: hoursText(data.approvedHours),
    start: longDate(data.startDate),
    end: longDate(data.endDate),
  };
  return body.replace(/\{([a-z_]+)\}/g, (match, key: string) => values[key] ?? match);
}
