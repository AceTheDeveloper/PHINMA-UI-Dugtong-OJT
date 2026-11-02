import { describe, expect, it } from "vitest";
import { maxResumeBytes, readResumeUpload, startsLikePdf } from "@/lib/resume/file";

function form(file?: File) {
  const data = new FormData();
  if (file) data.set("file", file);
  return data;
}

const pdfBytes = new TextEncoder().encode("%PDF-1.7\nhello");

function pdf(name = "resume.pdf", type = "application/pdf", bytes: BlobPart = pdfBytes) {
  return new File([bytes], name, { type });
}

describe("readResumeUpload", () => {
  it("accepts a PDF and returns its bytes", async () => {
    const result = await readResumeUpload(form(pdf()));
    expect(result.ok).toBe(true);
    if (result.ok) expect(Array.from(result.data)).toEqual(Array.from(pdfBytes));
  });

  it("accepts a file of exactly 2 MB", async () => {
    const bytes = new Uint8Array(maxResumeBytes);
    bytes.set(pdfBytes);
    expect((await readResumeUpload(form(pdf("r.pdf", "application/pdf", bytes)))).ok).toBe(true);
  });

  it("refuses a file over 2 MB", async () => {
    const bytes = new Uint8Array(maxResumeBytes + 1);
    bytes.set(pdfBytes);
    const result = await readResumeUpload(form(pdf("r.pdf", "application/pdf", bytes)));
    expect(result).toMatchObject({ ok: false, error: { code: "validation" } });
  });

  it("refuses an empty file", async () => {
    const result = await readResumeUpload(form(pdf("r.pdf", "application/pdf", "")));
    expect(result).toMatchObject({ ok: false, error: { code: "validation" } });
  });

  it("refuses a missing file and a non-form input", async () => {
    expect(await readResumeUpload(form())).toMatchObject({ ok: false });
    expect(await readResumeUpload(undefined)).toMatchObject({ ok: false });
    expect(await readResumeUpload({ file: pdf() })).toMatchObject({ ok: false });
  });

  it.each([
    [
      "a Word file",
      "resume.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    ["an image", "resume.png", "image/png"],
    ["a text file", "resume.txt", "text/plain"],
    ["a PDF name with another type", "resume.pdf", "text/plain"],
    ["a PDF type with another name", "resume.docx", "application/pdf"],
  ])("refuses %s", async (_label, name, type) => {
    const result = await readResumeUpload(form(pdf(name, type)));
    expect(result).toMatchObject({ ok: false, error: { code: "validation" } });
  });

  it("refuses a file renamed to .pdf without the PDF signature", async () => {
    const fake = pdf("resume.pdf", "application/pdf", "PK-not-a-pdf");
    const result = await readResumeUpload(form(fake));
    expect(result).toMatchObject({
      ok: false,
      error: { code: "validation", message: "Only PDF files are accepted." },
    });
  });
});

describe("startsLikePdf", () => {
  it("needs the %PDF- signature at the very start", () => {
    expect(startsLikePdf(pdfBytes)).toBe(true);
    expect(startsLikePdf(new TextEncoder().encode(" %PDF-1.7"))).toBe(false);
    expect(startsLikePdf(new Uint8Array())).toBe(false);
  });
});
