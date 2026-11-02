import { inflateSync } from "node:zlib";

// pdf-lib compresses each page and writes its text as hexadecimal strings. This
// reads them back: inflate every stream, take each shown string, and join them
// with a space, so a test can check what a page says.
export function pdfPages(bytes: Uint8Array): string[] {
  const raw = Buffer.from(bytes).toString("latin1");
  const pages: string[] = [];
  for (const stream of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(stream[1], "latin1")).toString("latin1");
    } catch {
      continue;
    }
    const shown: string[] = [];
    for (const match of content.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
      shown.push(Buffer.from(match[1], "hex").toString("latin1"));
    }
    if (shown.length > 0) pages.push(shown.join(" "));
  }
  return pages;
}

export function pdfText(bytes: Uint8Array): string {
  return pdfPages(bytes).join(" ");
}
