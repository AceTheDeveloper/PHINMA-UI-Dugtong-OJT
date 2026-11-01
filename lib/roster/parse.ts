import Papa from "papaparse";
import { readSheet } from "read-excel-file/node";
import { fail, ok, type Result } from "@/lib/result";

// Turns an uploaded CSV or Excel file into plain text rows. Pure: it takes
// bytes and a file name, touches no database, and keeps every cell as text so
// a student number like 04-2122-041550 keeps its zeros. Row numbers are the
// spreadsheet's own (the header is row 1), so a message points at the row the
// coordinator sees in Excel.

export const maxFileBytes = 2 * 1024 * 1024;
export const maxRosterRows = 1000;
export const rosterColumns = ["full_name", "student_number", "email"] as const;

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

  let grid: string[][];
  try {
    grid = xlsx ? await readExcel(file.bytes) : readCsv(file.bytes);
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
  const missing = rosterColumns.filter((column) => !position.has(column));
  if (missing.length > 0) {
    return fail(
      "validation",
      `The header row is missing ${missing.join(", ")}. Use the columns ${rosterColumns.join(", ")}.`,
    );
  }

  const rows: RosterRow[] = [];
  for (let index = headerIndex + 1; index < grid.length; index += 1) {
    const line = grid[index];
    if (line.every((cell) => cell === "")) continue;
    rows.push({
      row: index + 1,
      fullName: line[position.get("full_name") ?? 0] ?? "",
      studentNumber: line[position.get("student_number") ?? 0] ?? "",
      email: line[position.get("email") ?? 0] ?? "",
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
