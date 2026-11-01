import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { readSheet } from "read-excel-file/node";
import writeExcelFile from "write-excel-file/node";
import { parseRosterFile } from "@/lib/roster/parse";
import { maxEntryBytes, maxTotalBytes, repackXlsx } from "@/lib/roster/safe-zip";

// Builds a ZIP by hand so the tests can do what real tools will not: lie about
// sizes, hide entries the central directory does not list, set flags.
type Entry = {
  name: string;
  data: Uint8Array;
  method?: 0 | 8;
  declaredSize?: number;
  flags?: number;
  // written as a local entry but left out of the central directory
  hidden?: boolean;
};

function zip(entries: Entry[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const encoder = new TextEncoder();
  let listed = 0;

  for (const entry of entries) {
    const method = entry.method ?? 8;
    const body = method === 8 ? new Uint8Array(deflateRawSync(entry.data)) : entry.data;
    const name = encoder.encode(entry.name);
    const declared = entry.declaredSize ?? entry.data.length;

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, method, true);
    lv.setUint32(18, body.length, true);
    lv.setUint32(22, declared, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    parts.push(local, body);

    if (!entry.hidden) {
      const dir = new Uint8Array(46 + name.length);
      const dv = new DataView(dir.buffer);
      dv.setUint32(0, 0x02014b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 20, true);
      dv.setUint16(8, entry.flags ?? 0, true);
      dv.setUint16(10, method, true);
      dv.setUint32(20, body.length, true);
      dv.setUint32(24, declared, true);
      dv.setUint16(28, name.length, true);
      dv.setUint32(42, offset, true);
      dir.set(name, 46);
      central.push(dir);
      listed += 1;
    }
    offset += local.length + body.length;
  }

  const directorySize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, listed, true);
  ev.setUint16(10, listed, true);
  ev.setUint32(12, directorySize, true);
  ev.setUint32(16, offset, true);

  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of all) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

const zeros = (size: number) => new Uint8Array(size);
const text = (value: string) => new TextEncoder().encode(value);

describe("repackXlsx", () => {
  it("rebuilds a real workbook so the reader gets the same data", async () => {
    const buffer = await writeExcelFile([
      ["full_name", "student_number", "email"],
      ["Ana", "04-2122-041550", "a@example.test"],
    ]).toBuffer();
    const clean = repackXlsx(new Uint8Array(buffer));
    expect(clean).not.toBeNull();
    const sheet = await readSheet(Buffer.from(clean as Uint8Array));
    expect(sheet).toEqual([
      ["full_name", "student_number", "email"],
      ["Ana", "04-2122-041550", "a@example.test"],
    ]);
  });

  it("accepts small stored and deflated entries", () => {
    const clean = repackXlsx(
      zip([
        { name: "a.xml", data: zeros(1000), method: 0 },
        { name: "b.xml", data: zeros(1000) },
      ]),
    );
    expect(clean).not.toBeNull();
  });

  it("refuses an entry that unpacks past the per-entry cap, though the file is tiny", () => {
    const bomb = zip([{ name: "sheet.xml", data: zeros(maxEntryBytes + 1) }]);
    expect(bomb.length).toBeLessThan(100_000);
    expect(repackXlsx(bomb)).toBeNull();
  });

  it("refuses a bomb that lies about its size in the header", () => {
    const bomb = zip([{ name: "sheet.xml", data: zeros(maxEntryBytes + 1), declaredSize: 10 }]);
    expect(repackXlsx(bomb)).toBeNull();
  });

  it("refuses many entries that together pass the total cap", () => {
    const each = Math.floor(maxTotalBytes / 3) + 1024 * 1024;
    const bomb = zip(Array.from({ length: 4 }, (_, i) => ({ name: `s${i}.xml`, data: zeros(each) })));
    expect(repackXlsx(bomb)).toBeNull();
  });

  it("drops an entry the central directory does not list, so a hidden bomb never reaches the reader", () => {
    const withHidden = zip([
      { name: "hidden.xml", data: zeros(maxEntryBytes * 2), hidden: true },
      { name: "visible.xml", data: text("hello") },
    ]);
    const clean = repackXlsx(withHidden);
    expect(clean).not.toBeNull();
    // only the one visible entry was carried over, so the copy is tiny
    expect((clean as Uint8Array).length).toBeLessThan(500);
    expect(new TextDecoder().decode(clean as Uint8Array)).not.toContain("hidden.xml");
  });

  it("refuses too many entries", () => {
    const many = zip(Array.from({ length: 201 }, (_, i) => ({ name: `f${i}`, data: zeros(1) })));
    expect(repackXlsx(many)).toBeNull();
  });

  it("refuses duplicate names, which two readers could resolve differently", () => {
    expect(
      repackXlsx(zip([{ name: "a.xml", data: text("one") }, { name: "a.xml", data: text("two") }])),
    ).toBeNull();
  });

  it("refuses encrypted entries and unsafe paths", () => {
    expect(repackXlsx(zip([{ name: "a.xml", data: text("x"), flags: 1 }]))).toBeNull();
    expect(repackXlsx(zip([{ name: "../evil.xml", data: text("x") }]))).toBeNull();
    expect(repackXlsx(zip([{ name: "/abs.xml", data: text("x") }]))).toBeNull();
    expect(repackXlsx(zip([{ name: "dir\\a.xml", data: text("x") }]))).toBeNull();
  });

  it("refuses data that is not a ZIP, a truncated ZIP, and an unknown method", () => {
    expect(repackXlsx(new Uint8Array([1, 2, 3, 4, 5]))).toBeNull();
    const good = zip([{ name: "a.xml", data: zeros(100) }]);
    expect(repackXlsx(good.subarray(0, good.length - 10))).toBeNull();
    const odd = zip([{ name: "a.xml", data: zeros(10), method: 0 }]);
    const view = new DataView(odd.buffer);
    // the central directory entry follows the local header (30 + name) and the data
    view.setUint16(30 + "a.xml".length + 10 + 10, 12, true);
    expect(repackXlsx(odd)).toBeNull();
  });

  it("is applied before the roster is read", async () => {
    const bomb = zip([{ name: "xl/worksheets/sheet1.xml", data: zeros(maxEntryBytes + 1) }]);
    const result = await parseRosterFile({ name: "roster.xlsx", bytes: bomb });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/too large once unpacked/);
  });

  it("reports a safe ZIP that is not a workbook as unreadable", async () => {
    const notAWorkbook = zip([{ name: "readme.txt", data: text("hello") }]);
    const result = await parseRosterFile({ name: "roster.xlsx", bytes: notAWorkbook });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/could not be read/);
  });
});
