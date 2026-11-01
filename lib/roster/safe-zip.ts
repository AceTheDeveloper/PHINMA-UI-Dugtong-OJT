import { crc32, inflateRawSync } from "node:zlib";

// An .xlsx file is a ZIP. A small upload can unpack to gigabytes (a "zip
// bomb"), and two ZIP readers can disagree about what is inside one file (one
// follows the central directory, another walks the local headers). So the
// Excel reader never sees the upload. This module unpacks it once with a hard
// output cap per entry and in total, then builds a fresh, plain ZIP out of only
// the entries it measured, and the reader gets that. Anything odd (ZIP64,
// encryption, an unknown method, a duplicate or unsafe name, a bad offset) is
// refused.

export const maxEntryBytes = 10 * 1024 * 1024;
export const maxTotalBytes = 25 * 1024 * 1024;
export const maxEntries = 200;

const eocdSignature = 0x06054b50;
const centralSignature = 0x02014b50;
const localSignature = 0x04034b50;
const zip64Marker = 0xffffffff;

type Entry = { name: Uint8Array; data: Uint8Array };

// A clean copy of the workbook that is safe to hand to the Excel reader, or
// null if the upload is not a safe ZIP.
export function repackXlsx(bytes: Uint8Array): Uint8Array | null {
  try {
    const entries = unpack(bytes);
    return entries ? pack(entries) : null;
  } catch {
    return null;
  }
}

function unpack(bytes: Uint8Array): Entry[] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // The end-of-central-directory record sits in the last 64 KB plus its own length.
  let eocd = -1;
  const lowest = Math.max(0, bytes.length - 22 - 0xffff);
  for (let at = bytes.length - 22; at >= lowest; at -= 1) {
    if (view.getUint32(at, true) === eocdSignature) {
      eocd = at;
      break;
    }
  }
  if (eocd === -1) return null;

  const count = view.getUint16(eocd + 10, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  if (count === 0 || count > maxEntries || directoryOffset === zip64Marker) return null;

  const decoder = new TextDecoder("utf-8", { fatal: true });
  const seen = new Set<string>();
  const entries: Entry[] = [];
  let total = 0;
  let cursor = directoryOffset;

  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== centralSignature) {
      return null;
    }
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const declaredSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    if (cursor + 46 + nameLength > bytes.length) return null;
    const name = bytes.slice(cursor + 46, cursor + 46 + nameLength);
    cursor += 46 + nameLength + extraLength + commentLength;

    // Bit 0 is encryption. ZIP64 sizes and offsets are not used by workbooks.
    if ((flags & 1) !== 0) return null;
    if (compressedSize === zip64Marker || declaredSize === zip64Marker || localOffset === zip64Marker) {
      return null;
    }

    // A workbook part is a plain relative path, never absolute or climbing out.
    const text = decoder.decode(name);
    if (text === "" || text.startsWith("/") || text.includes("\\") || text.split("/").includes("..")) {
      return null;
    }
    if (seen.has(text)) return null;
    seen.add(text);

    if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== localSignature) {
      return null;
    }
    const dataStart =
      localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
    if (dataStart + compressedSize > bytes.length) return null;
    const raw = bytes.subarray(dataStart, dataStart + compressedSize);

    let data: Uint8Array;
    if (method === 0) {
      if (raw.length > maxEntryBytes) return null;
      data = raw;
    } else if (method === 8) {
      // Throws if the real output is larger than the cap, whatever the header says.
      data = inflateRawSync(raw, { maxOutputLength: maxEntryBytes });
    } else {
      return null;
    }
    total += data.length;
    if (total > maxTotalBytes) return null;
    entries.push({ name, data });
  }
  return entries;
}

// A plain ZIP: every entry stored, local headers followed by one central
// directory that lists exactly those entries, in the same order.
function pack(entries: Entry[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const checksum = crc32(data);

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, localSignature, true);
    lv.setUint16(4, 20, true);
    lv.setUint32(14, checksum, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, centralSignature, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, checksum, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);

    locals.push(local, data);
    directory.push(central);
    offset += local.length + data.length;
  }

  const directorySize = directory.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, eocdSignature, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, directorySize, true);
  ev.setUint32(16, offset, true);

  const parts = [...locals, ...directory, end];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
