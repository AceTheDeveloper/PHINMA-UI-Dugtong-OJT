import Papa from "papaparse";
import { readSheet } from "read-excel-file/node";
import { repackXlsx } from "@/lib/roster/safe-zip";
import { fail, ok, type Result } from "@/lib/result";

// Turns an uploaded CSV or Excel file into plain text rows. Pure: it takes
// bytes and a file name, touches no database, and keeps every cell as text so
// a student number like 04-2122-041550 keeps its zeros. Row numbers are the
// spreadsheet's own (the header is row 1), so a message points at the row the
// coordinator sees in Excel.

export const maxFileBytes = 2 * 1024 * 1024;
export const maxRosterRows = 1000;

// The school's list of students taking OJT. Only the three read columns are
// needed; the rest are carried in the template and ignored. Header matching
// ignores case and spaces, and the older names stay accepted as aliases.
export const rosterColumns = [
  "SESSION NAME",
  "CAMPUS",
  "STUDENT ID",
  "STUDENT NAME",
  "GENDER",
  "COLLEGE",
  "COURSE",
  "CURRICULUM",
  "SUBJECT",
  "SECTION",
  "EMAIL",
] as const;

const fields = {
  fullName: { label: "STUDENT NAME", keys: ["student_name", "full_name"] },
  studentNumber: { label: "STUDENT ID", keys: ["student_id", "student_number"] },
  email: { label: "EMAIL", keys: ["email"] },
} as const;

export type RosterRow = {
  row: number;
  fullName: string;
  studentNumber: string;
  email: string;
};

const zipSignature = [0x50, 0x4b, 0x03, 0x04];

function isXlsx(bytes: Uint8Array): boolean {
  return zipSignature.every((byte, index) => bytes[index] === byte);
}

function looksBinary(bytes: Uint8Array): boolean {
  return bytes.subarray(0, 4096).includes(0);
}

// A cell as text. Excel hands back numbers, booleans, and dates for cells that
// are not text; none is expected here, so they are written out plainly.
function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return "";
}

function headerKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

const unreadable = "The file could not be read. Save it as .csv or .xlsx and try again.";

export async function parseRosterFile(file: {
  name: string;
  bytes: Uint8Array;
}): Promise<Result<RosterRow[]>> {
  const name = file.name.toLowerCase();
  const isCsvName = name.endsWith(".csv");
  const isXlsxName = name.endsWith(".xlsx");
  if (!isCsvName && !isXlsxName) {
    return fail("validation", "Upload a .csv or .xlsx file.");
  }
  if (file.bytes.length === 0) {
    return fail("validation", "The file is empty.");
  }
  if (file.bytes.length > maxFileBytes) {
    return fail("validation", "The file is larger than 2 MB. Split it and import in parts.");
  }
  // The name can lie, so the content decides how the file is read.
  const xlsx = isXlsx(file.bytes);
  if (isXlsxName !== xlsx || (!xlsx && looksBinary(file.bytes))) {
    return fail("validation", "The file does not match its extension. Save it again as .csv or .xlsx.");
  }

  // An .xlsx is a ZIP that can unpack far larger than it is. The reader never
  // sees the upload: it gets a clean copy built from entries measured under a cap.
  const workbook = xlsx ? repackXlsx(file.bytes) : null;
  if (xlsx && workbook === null) {
    return fail(
      "validation",
      "The Excel file is too large once unpacked, or it is damaged. Save the list as .csv and try again.",
    );
  }

  let grid: string[][];
  try {
    grid = workbook ? await readExcel(workbook) : readCsv(file.bytes);
  } catch {
    return fail("validation", unreadable);
  }
  return rowsFromGrid(grid);
}

function readCsv(bytes: Uint8Array): string[][] {
  const text = new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "");
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false });
  return parsed.data.map((line) => line.map(cellText));
}

async function readExcel(bytes: Uint8Array): Promise<string[][]> {
  const sheet = await readSheet(Buffer.from(bytes));
  return sheet.map((line) => line.map(cellText));
}

function rowsFromGrid(grid: string[][]): Result<RosterRow[]> {
  const headerIndex = grid.findIndex((line) => line.some((cell) => cell !== ""));
  if (headerIndex === -1) {
    return fail("validation", "The file is empty.");
  }
  const header = grid[headerIndex].map(headerKey);
  const position = new Map<string, number>();
  header.forEach((key, index) => {
    if (key && !position.has(key)) position.set(key, index);
  });
  const at = (field: keyof typeof fields): number | undefined => {
    for (const key of fields[field].keys) {
      const found = position.get(key);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  const missing = (Object.keys(fields) as (keyof typeof fields)[]).filter(
    (field) => at(field) === undefined,
  );
  if (missing.length > 0) {
    return fail(
      "validation",
      `The header row is missing ${missing.map((field) => fields[field].label).join(", ")}. Use the columns from the template.`,
    );
  }
  const nameAt = at("fullName") ?? 0;
  const numberAt = at("studentNumber") ?? 0;
  const emailAt = at("email") ?? 0;

  const rows: RosterRow[] = [];
  for (let index = headerIndex + 1; index < grid.length; index += 1) {
    const line = grid[index];
    if (line.every((cell) => cell === "")) continue;
    rows.push({
      row: index + 1,
      fullName: line[nameAt] ?? "",
      studentNumber: line[numberAt] ?? "",
      email: line[emailAt] ?? "",
    });
    if (rows.length > maxRosterRows) {
      return fail("validation", `The file has more than ${maxRosterRows} rows. Split it and import in parts.`);
    }
  }
  if (rows.length === 0) {
    return fail("validation", "The file has a header but no students.");
  }
  return ok(rows);
}
