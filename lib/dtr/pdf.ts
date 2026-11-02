import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { printable } from "@/lib/certification/pdf";
import { formatClock } from "@/lib/logs/logic";
import type { DtrData } from "@/lib/dtr/types";

// Draws the DTR. Pure: the same data always gives the same pages. Portrait A4;
// the heading, the student, the supervisor, and the table's column names repeat
// on every page, so a page torn off the stack still says whose it is. Standard
// PDF fonts only, so nothing is downloaded and nothing is stored.

const page = { width: 595.28, height: 841.89 };
const margin = 50;
const ink = rgb(0.06, 0.09, 0.16);
const muted = rgb(0.35, 0.4, 0.47);
const hairline = rgb(0.82, 0.85, 0.89);

const rowHeight = 22;
const tableTop = 655; // y of the column names
const firstRow = tableTop - 24;
const bottom = 80; // nothing is drawn below this, except the page number

const columns = {
  date: margin,
  timeIn: 280,
  timeOut: 370,
  hours: page.width - margin, // right edge: hours are right-aligned
};

const dayFormat = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function dtrDate(date: string): string {
  return dayFormat.format(new Date(`${date}T12:00:00+08:00`));
}

export function dtrHours(minutes: number): string {
  return (Math.max(0, minutes) / 60).toFixed(2);
}

// How many rows fit on a page, and how many pages a record needs. The total takes
// one more row; if it would not fit under the last entries it goes to a new page.
export const rowsPerPage = Math.floor((firstRow - bottom) / rowHeight);

export function pageCount(entries: number): number {
  return Math.max(1, Math.ceil((entries + 1) / rowsPerPage));
}

export async function generateDtrPdf(data: DtrData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Daily time record of ${data.studentNumber}`);
  pdf.setCreator("Dugtong OJT");
  pdf.setProducer("Dugtong OJT");
  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const totalMinutes = data.entries.reduce((sum, entry) => sum + entry.minutes, 0);
  const pages = pageCount(data.entries.length);
  const supervisor = data.supervisorName?.trim() ? data.supervisorName : "Not recorded";

  const text = (
    sheet: PDFPage,
    value: string,
    x: number,
    y: number,
    font: PDFFont,
    size: number,
    align: "left" | "right" = "left",
    color = ink,
  ) => {
    const safe = printable(font, value);
    const width = font.widthOfTextAtSize(safe, size);
    sheet.drawText(safe, { x: align === "right" ? x - width : x, y, size, font, color });
  };

  for (let index = 0; index < pages; index += 1) {
    const sheet = pdf.addPage([page.width, page.height]);

    // The header, the same on every page.
    text(sheet, "Daily time record", margin, 770, bold, 24);
    text(sheet, "Student", margin, 726, sans, 10, "left", muted);
    text(sheet, `${data.studentName} (${data.studentNumber})`, margin, 708, bold, 15);
    text(sheet, "Supervisor", margin, 682, sans, 10, "left", muted);
    text(sheet, supervisor, margin + 62, 682, regular, 13);

    // The column names and a rule under them.
    text(sheet, "Date", columns.date, tableTop, sansBold, 10);
    text(sheet, "Time in", columns.timeIn, tableTop, sansBold, 10);
    text(sheet, "Time out", columns.timeOut, tableTop, sansBold, 10);
    text(sheet, "Hours", columns.hours, tableTop, sansBold, 10, "right");
    sheet.drawLine({
      start: { x: margin, y: tableTop - 8 },
      end: { x: page.width - margin, y: tableTop - 8 },
      thickness: 0.75,
      color: ink,
    });

    const slice = data.entries.slice(index * rowsPerPage, (index + 1) * rowsPerPage);
    let y = firstRow;
    for (const entry of slice) {
      text(sheet, dtrDate(entry.date), columns.date, y, regular, 12);
      text(sheet, formatClock(entry.timeIn), columns.timeIn, y, regular, 12);
      text(sheet, formatClock(entry.timeOut), columns.timeOut, y, regular, 12);
      text(sheet, dtrHours(entry.minutes), columns.hours, y, regular, 12, "right");
      sheet.drawLine({
        start: { x: margin, y: y - 7 },
        end: { x: page.width - margin, y: y - 7 },
        thickness: 0.4,
        color: hairline,
      });
      y -= rowHeight;
    }

    if (data.entries.length === 0) {
      text(sheet, "No approved entries yet.", margin, firstRow, regular, 12, "left", muted);
      y -= rowHeight;
    }

    // The total goes under the last entries of the last page.
    if (index === pages - 1) {
      sheet.drawLine({
        start: { x: margin, y: y + rowHeight - 14 },
        end: { x: page.width - margin, y: y + rowHeight - 14 },
        thickness: 0.75,
        color: ink,
      });
      text(sheet, "Total approved hours", columns.date, y - 2, bold, 12);
      text(sheet, dtrHours(totalMinutes), columns.hours, y - 2, bold, 12, "right");
    }

    text(sheet, `Page ${index + 1} of ${pages}`, page.width / 2 - 28, 40, sans, 9, "left", muted);
  }

  return pdf.save();
}
