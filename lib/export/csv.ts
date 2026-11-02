// A small, safe CSV writer. Student data can start with any character, and a
// spreadsheet runs a cell that starts with = + - or @ as a formula, so text cells
// are defused. Every field is quoted, so commas, quotes, and line breaks inside a
// name cannot break the row. The file starts with a byte-order mark so Excel reads
// it as UTF-8 and shows Ñ and accents correctly.

export type Cell = string | number | null;

const bom = "﻿";

export function csvCell(value: Cell): string {
  if (value === null) return '""';
  let text = String(value);
  // A real number is not a formula, even when negative. Text is.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(head: readonly string[], rows: readonly (readonly Cell[])[]): string {
  const lines = [head, ...rows].map((row) => row.map(csvCell).join(","));
  return `${bom}${lines.join("\r\n")}\r\n`;
}
