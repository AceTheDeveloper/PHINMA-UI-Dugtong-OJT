import { describe, expect, it } from "vitest";
import { studentCsv, studentCsvHead, studentCsvName } from "@/lib/coordinator/export";
import type { Dashboard, DashboardStudent } from "@/lib/coordinator/types";
import { csvCell, toCsv } from "@/lib/export/csv";

describe("csvCell", () => {
  it("quotes every field and doubles the quotes inside", () => {
    expect(csvCell("Ana")).toBe('"Ana"');
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
  });

  it("keeps commas and line breaks inside the quotes", () => {
    expect(csvCell("DELA CRUZ, JUAN")).toBe('"DELA CRUZ, JUAN"');
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
  });

  it("writes numbers as they are, empty as an empty quoted field", () => {
    expect(csvCell(486.05)).toBe('"486.05"');
    expect(csvCell(0)).toBe('"0"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell("")).toBe('""');
  });

  it.each(["=SUM(A1:A9)", "+1+1", "-2+3", "@cmd", "\tTabbed", "\rReturn", "=HYPERLINK(\"http://x\")"])(
    "defuses %j so a spreadsheet cannot run it as a formula",
    (value) => {
      const cell = csvCell(value);
      expect(cell.startsWith(`"'`)).toBe(true);
      expect(cell).toContain(value.replace(/"/g, '""'));
    },
  );

  it("does not touch a negative number, which is a number and not a formula", () => {
    expect(csvCell(-5)).toBe('"-5"');
  });

  it("does not add a mark to text that merely contains a formula character", () => {
    expect(csvCell("Ana-Marie")).toBe('"Ana-Marie"');
    expect(csvCell("a=b")).toBe('"a=b"');
    expect(csvCell("x@y.com")).toBe('"x@y.com"');
  });
});

describe("toCsv", () => {
  it("starts with a byte-order mark, uses Windows line ends, and ends with one", () => {
    const csv = toCsv(["A", "B"], [["1", 2], ["x", null]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe('﻿"A","B"\r\n"1","2"\r\n"x",""\r\n');
  });

  it("has just the header for no rows", () => {
    expect(toCsv(["A"], [])).toBe('﻿"A"\r\n');
  });

  it("keeps Ñ and other accented letters as they are", () => {
    expect(toCsv(["Name"], [["PEÑA, JOSÉ"]])).toContain("PEÑA, JOSÉ");
  });
});

function student(over: Partial<DashboardStudent>): DashboardStudent {
  return {
    id: "s1",
    name: "DELA CRUZ, JUAN",
    studentNumber: "04-2122-000001",
    companyId: "c1",
    deploymentId: "d1",
    status: "active",
    approvedHours: 120.5,
    pendingEntries: 2,
    lastEntryDate: "2026-11-02",
    ...over,
  };
}

const dashboard = (students: DashboardStudent[]): Dashboard => ({
  course: {
    school: "PHINMA University of Iloilo",
    department: "College of IT",
    departmentShort: "CITE",
    course: "BS Information Technology",
    courseShort: "BSIT",
    batchLabel: "2026-2027",
    requiredHours: 486,
    staleThresholdDays: 3,
    asOf: "2026-11-03",
  },
  otherCourses: 0,
  students,
  companies: [{ id: "c1", name: "Northwind, Inc.", supervisors: 1 }],
  pending: [],
  open: [],
  activity: [],
  weekly: [],
});

describe("studentCsv", () => {
  it("has the agreed columns, in order", () => {
    expect(studentCsvHead).toEqual([
      "Name",
      "Student number",
      "Company",
      "Status",
      "Approved hours",
      "Required hours",
      "Pending entries",
      "Last entry date",
    ]);
    expect(studentCsv(dashboard([])).split("\r\n")[0]).toBe(
      '﻿"Name","Student number","Company","Status","Approved hours","Required hours","Pending entries","Last entry date"',
    );
  });

  it("writes one row per student with the company name and the stage in words", () => {
    const lines = studentCsv(
      dashboard([
        student({}),
        student({ id: "s2", name: "LIM, CARA", studentNumber: "SN-2", companyId: null, status: "ready", approvedHours: 486, pendingEntries: 0, lastEntryDate: null }),
      ]),
    ).split("\r\n");
    expect(lines[1]).toBe('"DELA CRUZ, JUAN","04-2122-000001","Northwind, Inc.","Active","120.5","486","2","2026-11-02"');
    expect(lines[2]).toBe('"LIM, CARA","SN-2","","Ready for evaluation","486","486","0",""');
    expect(lines).toHaveLength(4);
  });

  it("defuses a student name that starts with a formula character, and keeps the number", () => {
    const csv = studentCsv(dashboard([student({ name: "=CMD|' /C calc'!A0", studentNumber: "-12" })]));
    expect(csv).toContain(`"'=CMD|' /C calc'!A0"`);
    expect(csv).toContain(`"'-12"`);
  });

  it("is only the header for a course with no students", () => {
    expect(studentCsv(dashboard([])).split("\r\n")).toHaveLength(2);
  });

  it("names the file after the course and the batch, using only safe characters", () => {
    expect(studentCsvName(dashboard([]))).toBe("student-progress-BSIT-2026-2027.csv");
    const odd = dashboard([]);
    odd.course.courseShort = '../"BS IT"';
    odd.course.batchLabel = "2026/27";
    expect(studentCsvName(odd)).toBe("student-progress-BSIT-202627.csv");
    odd.course.courseShort = "///";
    expect(studentCsvName(odd)).toBe("student-progress-course-202627.csv");
  });
});
