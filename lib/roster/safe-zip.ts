import { inflateRawSync } from "node:zlib";

// An .xlsx file is a ZIP. A small upload can unpack to gigabytes (a "zip
// bomb"), and the Excel reader would unpack all of it into memory. This runs
// first: it walks the ZIP's central directory and inflates every entry with a
// hard output cap, so the real unpacked size is measured, not the size the file
// claims. Anything odd (ZIP64, an unknown method, a bad offset) is refused.

export const maxEntryBytes = 10 * 1024 * 1024;
export const maxTotalBytes = 25 * 1024 * 1024;
export const maxEntries = 200;

const eocdSignature = 0x06054b50;
const centralSignature = 0x02014b50;
const localSignature = 0x04034b50;
const zip64Marker = 0xffffffff;

export function isSafeXlsx(bytes: Uint8Array): boolean {
  try {
    return measure(bytes);
  } catch {
    return false;
  }
}

function measure(bytes: Uint8Array): boolean {
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
  if (eocd === -1) return false;

  const entries = view.getUint16(eocd + 10, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  if (entries === 0 || entries > maxEntries || directoryOffset === zip64Marker) return false;

  let total = 0;
  let cursor = directoryOffset;
  for (let index = 0; index < entries; index += 1) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== centralSignature) {
      return false;
    }
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const declaredSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    cursor += 46 + nameLength + extraLength + commentLength;

    if (compressedSize === zip64Marker || declaredSize === zip64Marker || localOffset === zip64Marker) {
      return false;
    }
    if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== localSignature) {
      return false;
    }
    const dataStart =
      localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
    if (dataStart + compressedSize > bytes.length) return false;
    const data = bytes.subarray(dataStart, dataStart + compressedSize);

    let size: number;
    if (method === 0) {
      size = compressedSize;
    } else if (method === 8) {
      // Throws if the real output is larger than the cap.
      size = inflateRawSync(data, { maxOutputLength: maxEntryBytes }).length;
    } else {
      return false;
    }
    if (size > maxEntryBytes) return false;
    total += size;
    if (total > maxTotalBytes) return false;
  }
  return true;
}
