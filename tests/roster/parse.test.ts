import { describe, expect, it } from "vitest";
import writeExcelFile from "write-excel-file/node";
import { maxFileBytes, parseRosterFile } from "@/lib/roster/parse";

const encoder = new TextEncoder();

function csv(text: string, name = "roster.csv") {
  return { name, bytes: encoder.encode(text) };
}

async function xlsx(data: (string | number | null)[][], name = "roster.xlsx") {
  const buffer = await writeExcelFile(data).toBuffer();
  return { name, bytes: new Uint8Array(buffer) };
}

async function rowsOf(file: { name: string; bytes: Uint8Array }) {
  const result = await parseRosterFile(file);
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}

async function messageOf(file: { name: string; bytes: Uint8Array }) {
  const result = await parseRosterFile(file);
  if (result.ok) throw new Error("expected a failure");
  return result.error.message;
}

describe("CSV", () => {
  it("reads the school template", async () => {
    const rows = await rowsOf(
      csv(
        "full_name,student_number,email\nAna Reyes,A-2026-001,ana.reyes@example.com\nBen Santos,A-2026-002,ben.santos@example.com\n",
      ),
    );
    expect(rows).toEqual([
      { row: 2, fullName: "Ana Reyes", studentNumber: "A-2026-001", email: "ana.reyes@example.com" },
      { row: 3, fullName: "Ben Santos", studentNumber: "A-2026-002", email: "ben.santos@example.com" },
    ]);
  });

  it("handles a BOM, Windows line endings, and a missing final newline", async () => {
    const rows = await rowsOf(
      csv("﻿full_name,student_number,email\r\nAna,1,a@example.com\r\nBen,2,b@example.com"),
    );
    expect(rows.map((row) => row.fullName)).toEqual(["Ana", "Ben"]);
  });

  it("keeps quoted commas and leading zeros", async () => {
    const rows = await rowsOf(
      csv('full_name,student_number,email\n"Reyes, Ana",04-2122-041550,a@example.com\nBen,007,b@example.com'),
    );
    expect(rows[0].fullName).toBe("Reyes, Ana");
    expect(rows[0].studentNumber).toBe("04-2122-041550");
    expect(rows[1].studentNumber).toBe("007");
  });

  it("matches headers by name, in any order, case, and spacing, and ignores extra columns", async () => {
    const rows = await rowsOf(
      csv("Email, Notes ,Student Number,Full-Name\na@example.com,x,1,Ana\n"),
    );
    expect(rows).toEqual([{ row: 2, fullName: "Ana", studentNumber: "1", email: "a@example.com" }]);
  });

  it("skips blank lines but keeps the spreadsheet's row numbers", async () => {
    const rows = await rowsOf(
      csv("full_name,student_number,email\n\nAna,1,a@example.com\n,,\nBen,2,b@example.com\n"),
    );
    expect(rows.map((row) => row.row)).toEqual([3, 5]);
  });

  it("starts at the first non-empty row, so a blank first line is allowed", async () => {
    const rows = await rowsOf(csv("\n\nfull_name,student_number,email\nAna,1,a@example.com"));
    expect(rows[0].row).toBe(4);
  });

  it("reads a semicolon-separated file", async () => {
    const rows = await rowsOf(csv("full_name;student_number;email\nAna;1;a@example.com\n"));
    expect(rows[0].email).toBe("a@example.com");
  });

  it("keeps a row with a missing cell so the preview can name it", async () => {
    const rows = await rowsOf(csv("full_name,student_number,email\nAna,1\n"));
    expect(rows[0]).toMatchObject({ fullName: "Ana", studentNumber: "1", email: "" });
  });
});

describe("Excel", () => {
  it("reads the first sheet as text and keeps text student numbers", async () => {
    const rows = await rowsOf(
      await xlsx([
        ["full_name", "student_number", "email"],
        ["Ana Reyes", "04-2122-041550", "ana@example.com"],
        ["Ben Santos", "007", "ben@example.com"],
      ]),
    );
    expect(rows).toEqual([
      { row: 2, fullName: "Ana Reyes", studentNumber: "04-2122-041550", email: "ana@example.com" },
      { row: 3, fullName: "Ben Santos", studentNumber: "007", email: "ben@example.com" },
    ]);
  });

  it("writes numeric cells out as plain text", async () => {
    const rows = await rowsOf(
      await xlsx([
        ["full_name", "student_number", "email"],
        ["Ana", 20260001, "a@example.com"],
      ]),
    );
    expect(rows[0].studentNumber).toBe("20260001");
  });
});

describe("refusals", () => {
  it("refuses a file that is not .csv or .xlsx", async () => {
    expect(await messageOf(csv("a", "roster.txt"))).toBe("Upload a .csv or .xlsx file.");
    expect(await messageOf(csv("a", "roster.xls"))).toBe("Upload a .csv or .xlsx file.");
  });

  it("refuses an empty file", async () => {
    expect(await messageOf(csv(""))).toBe("The file is empty.");
    expect(await messageOf(csv("\n\n\n"))).toBe("The file is empty.");
  });

  it("refuses a file over 2 MB", async () => {
    const big = { name: "roster.csv", bytes: new Uint8Array(maxFileBytes + 1).fill(97) };
    expect(await messageOf(big)).toMatch(/larger than 2 MB/);
  });

  it("refuses a name that does not match the content", async () => {
    const real = await xlsx([["full_name", "student_number", "email"]]);
    expect(await messageOf({ name: "roster.csv", bytes: real.bytes })).toMatch(/does not match its extension/);
    expect(await messageOf(csv("a,b,c", "roster.xlsx"))).toMatch(/does not match its extension/);
  });

  it("refuses a binary file renamed to .csv", async () => {
    const binary = { name: "roster.csv", bytes: new Uint8Array([1, 2, 0, 3, 4, 5]) };
    expect(await messageOf(binary)).toMatch(/does not match its extension/);
  });

  it("names the missing header columns", async () => {
    expect(await messageOf(csv("full_name,email\nAna,a@example.com"))).toBe(
      "The header row is missing student_number. Use the columns full_name, student_number, email.",
    );
    expect(await messageOf(csv("name,number,mail\nAna,1,a@example.com"))).toMatch(
      /missing full_name, student_number, email/,
    );
  });

  it("refuses a header with no students", async () => {
    expect(await messageOf(csv("full_name,student_number,email\n"))).toBe(
      "The file has a header but no students.",
    );
  });

  it("refuses more than 1000 rows and accepts exactly 1000", async () => {
    const body = (count: number) =>
      Array.from({ length: count }, (_, i) => `S${i},N-${i},s${i}@example.com`).join("\n");
    const header = "full_name,student_number,email\n";
    expect(await rowsOf(csv(header + body(1000)))).toHaveLength(1000);
    expect(await messageOf(csv(header + body(1001)))).toMatch(/more than 1000 rows/);
  });

  it("refuses a corrupt .xlsx without throwing", async () => {
    const corrupt = { name: "roster.xlsx", bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4]) };
    expect(await messageOf(corrupt)).toMatch(/could not be read/);
  });
});
