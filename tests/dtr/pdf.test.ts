import { writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { dtrDate, dtrHours, generateDtrPdf, pageCount, rowsPerPage } from "@/lib/dtr/pdf";
import type { DtrData, DtrEntry } from "@/lib/dtr/types";
import { pdfPages, pdfText } from "../helpers/pdf-text";

function entry(index: number, minutes = 9 * 60): DtrEntry {
  // One weekday-ish entry per day from 2026-08-17, 08:00 to 17:00 Manila.
  const day = new Date(Date.UTC(2026, 7, 17 + index));
  const date = day.toISOString().slice(0, 10);
  return {
    date,
    timeIn: `${date}T08:00:00+08:00`,
    timeOut: new Date(Date.parse(`${date}T08:00:00+08:00`) + minutes * 60000).toISOString(),
    minutes,
  };
}

const data = (entries: DtrEntry[], over: Partial<DtrData> = {}): DtrData => ({
  studentName: "SIMONDAC, ARWIN CLYDE BUENAVIDES",
  studentNumber: "04-2122-041550",
  supervisorName: "Supervisor John Doe",
  entries,
  ...over,
});

async function sample(name: string, value: DtrData) {
  const bytes = await generateDtrPdf(value);
  if (process.env.DTR_SAMPLE_DIR) writeFileSync(`${process.env.DTR_SAMPLE_DIR}/${name}.pdf`, bytes);
  return bytes;
}

describe("generateDtrPdf", () => {
  it("makes a valid portrait A4 PDF with the student, the supervisor, the entries, and the total", async () => {
    const bytes = await sample("short", data([entry(0), entry(1, 8 * 60 + 30), entry(3, 4 * 60)]));
    expect(Buffer.from(bytes).subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
    const { width, height } = loaded.getPage(0).getSize();
    expect(height).toBeGreaterThan(width);

    const text = pdfText(bytes);
    for (const piece of [
      "Daily time record",
      "SIMONDAC, ARWIN CLYDE BUENAVIDES (04-2122-041550)",
      "Supervisor John Doe",
      "Mon, Aug 17, 2026",
      "8:00 AM",
      "5:00 PM",
      "9.00",
      "8.50",
      "4.00",
      "Total approved hours",
      "21.50",
      "Page 1 of 1",
    ]) {
      expect(text, piece).toContain(piece);
    }
  });

  it("writes the time out of a short day in school time", async () => {
    const bytes = await generateDtrPdf(data([entry(0, 4 * 60)]));
    expect(pdfText(bytes)).toContain("12:00 PM");
  });

  it("still makes a PDF for a student with no approved entries", async () => {
    const bytes = await sample("empty", data([]));
    const text = pdfText(bytes);
    expect(text).toContain("No approved entries yet.");
    expect(text).toContain("Total approved hours");
    expect(text).toContain("0.00");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it("runs a long record onto more pages, the header on each, the total only on the last", async () => {
    const entries = Array.from({ length: 60 }, (_, index) => entry(index));
    const bytes = await sample("long", data(entries));
    const pages = pdfPages(bytes);
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(pageCount(60));
    expect(loaded.getPageCount()).toBeGreaterThan(2);
    expect(pages).toHaveLength(loaded.getPageCount());
    pages.forEach((page, index) => {
      expect(page).toContain("Daily time record");
      expect(page).toContain("SIMONDAC, ARWIN CLYDE BUENAVIDES (04-2122-041550)");
      expect(page).toContain("Supervisor John Doe");
      expect(page).toContain(`Page ${index + 1} of ${pages.length}`);
      expect(page.includes("Total approved hours")).toBe(index === pages.length - 1);
    });
    expect(pages.at(-1)).toContain("540.00");
  });

  it("shows every entry exactly once across the pages", async () => {
    const entries = Array.from({ length: 60 }, (_, index) => entry(index));
    const text = pdfText(await generateDtrPdf(data(entries)));
    for (const item of entries) {
      expect(text.split(dtrDate(item.date)).length - 1, item.date).toBe(1);
    }
  });

  it("moves the total to a new page when the entries fill the last one", async () => {
    const entries = Array.from({ length: rowsPerPage }, (_, index) => entry(index));
    expect(pageCount(rowsPerPage)).toBe(2);
    expect(pageCount(rowsPerPage - 1)).toBe(1);
    const pages = pdfPages(await generateDtrPdf(data(entries)));
    expect(pages).toHaveLength(2);
    expect(pages[0]).not.toContain("Total approved hours");
    expect(pages[1]).toContain("Total approved hours");
  });

  it("says the supervisor is not recorded when there is none", async () => {
    expect(pdfText(await generateDtrPdf(data([entry(0)], { supervisorName: null })))).toContain("Not recorded");
    expect(pdfText(await generateDtrPdf(data([entry(0)], { supervisorName: "   " })))).toContain("Not recorded");
  });

  it("does not fail on characters the standard fonts lack", async () => {
    const bytes = await generateDtrPdf(
      data([entry(0)], { studentName: "DELA CRUZ, JOSÉ ÑÑ 王小明 😀", supervisorName: "Supervisor 李 ✓" }),
    );
    expect(Buffer.from(bytes).subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdfText(bytes)).toContain("DELA CRUZ, JOS");
    expect(pdfText(bytes)).toContain("Supervisor ? ?");
  });
});

describe("helpers", () => {
  it.each([
    [0, "0.00"],
    [540, "9.00"],
    [510, "8.50"],
    [1, "0.02"],
    [-5, "0.00"],
  ])("writes %s minutes as %s hours", (minutes, hours) => {
    expect(dtrHours(minutes)).toBe(hours);
  });

  it("writes a school date with the weekday", () => {
    expect(dtrDate("2026-11-02")).toBe("Mon, Nov 2, 2026");
    expect(dtrDate("2026-12-31")).toBe("Thu, Dec 31, 2026");
  });

  it("needs at least one page, and one more row for the total", () => {
    expect(pageCount(0)).toBe(1);
    expect(rowsPerPage).toBeGreaterThan(15);
  });
});
