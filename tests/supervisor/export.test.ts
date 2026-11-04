import { describe, expect, it } from "vitest";
import {
  supervisorCsv,
  supervisorCsvHead,
  supervisorCsvName,
  type ExportDeployment,
} from "@/lib/supervisor/export";

// The supervisor's student progress CSV (ticket-34): the columns, the stage of
// each deployment, the safe CSV rules, and the file name.

function row(over: Partial<ExportDeployment> = {}): ExportDeployment {
  return {
    studentName: "Cruz, Ana",
    studentNumber: "04-2122-000001",
    courseCode: "BSIT",
    status: "active",
    startedAt: "2026-10-01T01:00:00Z",
    approvedHours: 120.5,
    requiredHours: 486,
    pendingEntries: 2,
    lastEntryDate: "2026-11-02",
    ...over,
  };
}

const bom = "﻿";

function lines(csv: string): string[][] {
  return csv
    .replace(bom, "")
    .trimEnd()
    .split("\r\n")
    .map((line) => line.slice(1, -1).split('","'));
}

describe("supervisorCsv", () => {
  it("has the agreed columns, in order", () => {
    expect(supervisorCsvHead).toEqual([
      "Student name",
      "Student number",
      "Course",
      "Status",
      "Start date",
      "Approved hours",
      "Required hours",
      "Pending entries",
      "Last entry date",
    ]);
    expect(lines(supervisorCsv([]))[0]).toEqual([...supervisorCsvHead]);
  });

  it("gives a company with no students only the header row", () => {
    const csv = supervisorCsv([]);
    expect(csv.replace(bom, "").trimEnd().split("\r\n")).toHaveLength(1);
  });

  it("starts with a byte-order mark and quotes every field", () => {
    const csv = supervisorCsv([row()]);
    expect(csv.startsWith(bom)).toBe(true);
    expect(lines(csv)[1]).toEqual([
      "Cruz, Ana",
      "04-2122-000001",
      "BSIT",
      "Active",
      "2026-10-01",
      "120.5",
      "486",
      "2",
      "2026-11-02",
    ]);
  });

  it("names the stage: active, ready for evaluation, completed, ended", () => {
    const csv = supervisorCsv([
      row({ studentName: "A", status: "active", approvedHours: 485.99 }),
      row({ studentName: "B", status: "active", approvedHours: 486 }),
      row({ studentName: "C", status: "completed", approvedHours: 490 }),
      row({ studentName: "D", status: "ended", approvedHours: 12 }),
    ]);
    const status = Object.fromEntries(lines(csv).slice(1).map((cells) => [cells[0], cells[3]]));
    expect(status).toEqual({
      A: "Active",
      B: "Ready for evaluation",
      C: "Completed",
      D: "Ended",
    });
  });

  it("writes zero hours and no entries as plain values", () => {
    const cells = lines(
      supervisorCsv([row({ approvedHours: 0, pendingEntries: 0, lastEntryDate: null })]),
    )[1];
    expect(cells.slice(5)).toEqual(["0", "486", "0", ""]);
  });

  it("shows the start date in Asia/Manila, not UTC", () => {
    // 17:00 UTC on the 31st is 01:00 on the 1st in Manila.
    const cells = lines(supervisorCsv([row({ startedAt: "2026-10-31T17:00:00Z" })]))[1];
    expect(cells[4]).toBe("2026-11-01");
  });

  it("lists active students first, then by name", () => {
    const csv = supervisorCsv([
      row({ studentName: "Zed", status: "ended" }),
      row({ studentName: "Mia", status: "active" }),
      row({ studentName: "Abe", status: "completed" }),
      row({ studentName: "Bea", status: "active" }),
    ]);
    expect(lines(csv).slice(1).map((cells) => cells[0])).toEqual(["Bea", "Mia", "Abe", "Zed"]);
  });

  it.each(["=EVIL()", "+1", "-1", "@SUM(A1)"])("makes the name %s safe", (name) => {
    const csv = supervisorCsv([row({ studentName: name })]);
    expect(csv).toContain(`"'${name}"`);
  });

  it("keeps Ñ and accents, and quotes inside a name", () => {
    const csv = supervisorCsv([row({ studentName: 'Niño "Jun" Peña' })]);
    expect(csv).toContain('"Niño ""Jun"" Peña"');
  });

  it("has no email, phone, resume, or journal column", () => {
    for (const column of supervisorCsvHead) {
      expect(column).not.toMatch(/email|phone|resume|journal/i);
    }
  });
});

describe("supervisorCsvName", () => {
  const now = new Date("2026-11-03T20:00:00Z"); // 2026-11-04 04:00 in Manila

  it("says the company and the school date", () => {
    expect(supervisorCsvName("Northwind", now)).toBe("student-progress-Northwind-2026-11-04.csv");
  });

  it("keeps only letters, digits, and dashes", () => {
    expect(supervisorCsvName("Acme & Sons, Inc. (Iloilo)/../x", now)).toBe(
      "student-progress-Acme-Sons-Inc-Iloilox-2026-11-04.csv",
    );
  });

  it("falls back when nothing is left of the name", () => {
    expect(supervisorCsvName("###", now)).toBe("student-progress-company-2026-11-04.csv");
  });
});
