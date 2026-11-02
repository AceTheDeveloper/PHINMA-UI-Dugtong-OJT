import { writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { generateCertificatePdf, printable, wrapLines } from "@/lib/certification/pdf";
import type { CertificateData } from "@/lib/certification/types";

const data: CertificateData = {
  id: "0f3a9c52-7d1e-4b8a-9c11-2e6d5a7b8c90",
  studentName: "SIMONDAC, ARWIN CLYDE BUENAVIDES",
  studentNumber: "04-2122-041550",
  courseName: "BS Information Technology",
  companyName: "Dugtong Company",
  supervisorName: "Supervisor John Doe",
  issuerName: "Coordinator Cruz",
  approvedHours: 486.05,
  requiredHours: 485,
  startDate: "2026-08-18",
  endDate: "2026-10-30",
  issuedAt: "2026-11-03T02:00:00Z",
  heading: "Certificate of completion",
  body: "This is to certify that {student} ({student_number}) of {course} has completed {hours} hours of on-the-job training at {company} from {start} to {end}.",
  signatories: [
    { name: "Person 1", title: "Signatory" },
    { name: "Person 2", title: "Signatory" },
  ],
};

// pdf-lib compresses each page and writes its text as hexadecimal strings. This
// reads them back: inflate every stream, take each shown string, and join the
// lines with a space, so a wrapped sentence reads as one.
function textOf(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes).toString("latin1");
  const shown: string[] = [];
  for (const stream of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(stream[1], "latin1")).toString("latin1");
    } catch {
      continue;
    }
    for (const match of content.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
      shown.push(Buffer.from(match[1], "hex").toString("latin1"));
    }
  }
  return shown.join(" ");
}
function contains(bytes: Uint8Array, text: string) {
  return textOf(bytes).includes(text);
}

describe("generateCertificatePdf", () => {
  it("makes a valid one-page landscape A4 PDF", async () => {
    const bytes = await generateCertificatePdf(data);
    expect(Buffer.from(bytes).subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
    const { width, height } = loaded.getPage(0).getSize();
    expect(width).toBeGreaterThan(height);
    expect(Math.round(width)).toBe(842);
  });

  it("shows the heading, the filled body, the signatories, and the footer", async () => {
    const bytes = await generateCertificatePdf(data);
    for (const text of [
      "Certificate of completion",
      "Person 1",
      "Person 2",
      "Evaluated by Supervisor John Doe",
      "Certification no. 0F3A9C52",
    ]) {
      expect(contains(bytes, text), text).toBe(true);
    }
    // The body is wrapped across lines, so look for pieces of it.
    for (const text of ["SIMONDAC, ARWIN CLYDE", "Dugtong Company", "August 18, 2026", "486.05"]) {
      expect(contains(bytes, text), text).toBe(true);
    }
    expect(contains(bytes, "{student}")).toBe(false);
  });

  it("gives the same bytes for the same snapshot, apart from the creation date", async () => {
    const a = await PDFDocument.load(await generateCertificatePdf(data));
    const b = await PDFDocument.load(await generateCertificatePdf(data));
    expect(a.getTitle()).toBe(b.getTitle());
    expect(a.getPageCount()).toBe(b.getPageCount());
  });

  it("still makes a PDF for a name with characters the standard fonts lack", async () => {
    const bytes = await generateCertificatePdf({
      ...data,
      studentName: "DELA CRUZ, JOSÉ ÑÑ 王小明 😀",
      heading: "Certificate 証明書",
      signatories: [
        { name: "Dr. Ana Reyes ✓", title: "Coordinator" },
        { name: "Prof. Ben Santos", title: "Dean" },
      ],
    });
    expect(Buffer.from(bytes).subarray(0, 5).toString("latin1")).toBe("%PDF-");
    // Western European letters are kept; the others become a question mark.
    expect(contains(bytes, "JOSÉ ÑÑ ? ?")).toBe(false);
    expect(contains(bytes, "DELA CRUZ, JOS")).toBe(true);
    expect(contains(bytes, "Dr. Ana Reyes ?")).toBe(true);
  });

  it("wraps a long body onto more lines without leaving the page", async () => {
    const bytes = await generateCertificatePdf({
      ...data,
      body: `${"This is a very long sentence about the training. ".repeat(12)}{student}`,
    });
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
  });

  it("writes a sample to look at when asked", async () => {
    if (!process.env.CERT_SAMPLE_PATH) return;
    writeFileSync(process.env.CERT_SAMPLE_PATH, await generateCertificatePdf(data));
  });
});

describe("printable", () => {
  it("keeps what the font has and replaces the rest", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.TimesRoman);
    expect(printable(font, "  José   Ñandú  ")).toBe("José Ñandú");
    expect(printable(font, "A王B")).toBe("A?B");
    expect(printable(font, "tab\tand\nnewline")).toBe("tab and newline");
  });
});

describe("wrapLines", () => {
  it("never makes a line wider than the limit, unless one word is wider by itself", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.TimesRoman);
    const lines = wrapLines(font, "one two three four five six seven eight nine ten", 17, 150);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(font.widthOfTextAtSize(line, 17)).toBeLessThanOrEqual(150);
    expect(lines.join(" ")).toBe("one two three four five six seven eight nine ten");
    expect(wrapLines(font, "Supercalifragilisticexpialidocious", 17, 50)).toEqual([
      "Supercalifragilisticexpialidocious",
    ]);
    expect(wrapLines(font, "", 17, 100)).toEqual([]);
  });
});
