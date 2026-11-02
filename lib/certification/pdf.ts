import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";
import { fillTemplate, longDateOfInstant } from "@/lib/certification/template";
import type { CertificateData } from "@/lib/certification/types";

// Draws the certificate from a certification's snapshot. Pure: the same snapshot
// always gives the same page. Uses the PDF standard fonts, so nothing is
// downloaded and nothing is stored.

const page = { width: 841.89, height: 595.28 }; // A4, landscape
const ink = rgb(0.06, 0.09, 0.16);
const muted = rgb(0.35, 0.4, 0.47);
const accent = rgb(0.15, 0.39, 0.92);

// The standard fonts only hold Western European letters. A name with any other
// character would make the whole PDF fail, so each such character becomes "?".
export function printable(font: PDFFont, text: string): string {
  let out = "";
  for (const char of text.replace(/\s+/g, " ").trim()) {
    try {
      font.encodeText(char);
      out += char;
    } catch {
      out += "?";
    }
  }
  return out;
}

// Breaks text into lines no wider than maxWidth.
export function wrapLines(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const attempt = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(attempt, size) <= maxWidth || line === "") {
      line = attempt;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function generateCertificatePdf(data: CertificateData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Certification of ${data.studentNumber}`);
  pdf.setCreator("Dugtong OJT");
  pdf.setProducer("Dugtong OJT");
  const sheet = pdf.addPage([page.width, page.height]);
  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const centered = (text: string, font: PDFFont, size: number, y: number, color = ink) => {
    const safe = printable(font, text);
    sheet.drawText(safe, {
      x: (page.width - font.widthOfTextAtSize(safe, size)) / 2,
      y,
      size,
      font,
      color,
    });
  };

  // A double border: a heavy line and a thin one inside it.
  sheet.drawRectangle({
    x: 24,
    y: 24,
    width: page.width - 48,
    height: page.height - 48,
    borderColor: accent,
    borderWidth: 3,
  });
  sheet.drawRectangle({
    x: 34,
    y: 34,
    width: page.width - 68,
    height: page.height - 68,
    borderColor: accent,
    borderWidth: 0.75,
  });

  centered(data.heading, bold, 36, 450);
  sheet.drawLine({
    start: { x: page.width / 2 - 60, y: 432 },
    end: { x: page.width / 2 + 60, y: 432 },
    thickness: 1.5,
    color: accent,
  });

  // The body, wrapped and centered.
  const body = printable(regular, fillTemplate(data.body, data));
  const lines = wrapLines(regular, body, 21, 640);
  let y = 375;
  for (const line of lines) {
    centered(line, regular, 21, y);
    y -= 33;
  }

  // Two signatories, each over a line.
  const columns = [page.width * 0.3, page.width * 0.7];
  data.signatories.forEach((signatory, index) => {
    const x = columns[index];
    const name = printable(bold, signatory.name);
    const title = printable(sans, signatory.title);
    sheet.drawLine({
      start: { x: x - 100, y: 140 },
      end: { x: x + 100, y: 140 },
      thickness: 0.75,
      color: ink,
    });
    sheet.drawText(name, {
      x: x - bold.widthOfTextAtSize(name, 14) / 2,
      y: 122,
      size: 14,
      font: bold,
      color: ink,
    });
    sheet.drawText(title, {
      x: x - sans.widthOfTextAtSize(title, 10.5) / 2,
      y: 106,
      size: 10.5,
      font: sans,
      color: muted,
    });
  });

  // Footer: who evaluated, who issued, when, and the certification number.
  centered(
    `Evaluated by ${data.supervisorName}. Issued by ${data.issuerName} on ${longDateOfInstant(data.issuedAt)}.`,
    sans,
    10,
    70,
    muted,
  );
  centered(`Certification no. ${data.id.slice(0, 8).toUpperCase()}`, sansBold, 9, 54, muted);

  return pdf.save();
}
