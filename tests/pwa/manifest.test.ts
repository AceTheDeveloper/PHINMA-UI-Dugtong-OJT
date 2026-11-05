import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { pwaColors } from "@/lib/pwa/colors";

// The web app manifest (ticket-35): the fields a browser needs to offer
// "Install app", the icons it points to, and the colours, which are copied out
// of the stylesheet and must stay in step with it.

const root = process.cwd();
const css = readFileSync(join(root, "app", "globals.css"), "utf8");

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("\n}", start));
  const found: Record<string, string> = {};
  for (const match of body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) found[match[1]] = match[2].trim();
  return found;
}

const light = tokens(":root");
const dark = tokens(".dark");

function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("manifest", () => {
  const data = manifest();

  it("names the app and opens it as an app, from where each person belongs", () => {
    expect(data).toMatchObject({
      name: "Dugtong OJT",
      short_name: "Dugtong",
      start_url: "/after-sign-in",
      scope: "/",
      display: "standalone",
    });
    expect(data.description).toBeTruthy();
  });

  it("starts at a page that sends every role home, or to sign-in", () => {
    expect(existsSync(join(root, "app", "(app)", "after-sign-in", "page.tsx"))).toBe(true);
  });

  it("has a 192 and a 512 icon, and a maskable 512, all real files of that size", () => {
    const icons = data.icons ?? [];
    const bySize = (size: string, purpose: string) =>
      icons.find((icon) => icon.sizes === size && icon.purpose === purpose);
    for (const [size, purpose] of [
      ["192x192", "any"],
      ["512x512", "any"],
      ["512x512", "maskable"],
    ] as const) {
      const icon = bySize(size, purpose);
      expect(icon, `${size} ${purpose}`).toBeDefined();
      expect(icon?.type).toBe("image/png");
      const expected = Number(size.split("x")[0]);
      expect(pngSize(join(root, "public", icon!.src))).toEqual({ width: expected, height: expected });
    }
  });

  it("has an Apple touch icon of 180 px", () => {
    expect(pngSize(join(root, "public", "icons", "apple-touch-icon.png"))).toEqual({ width: 180, height: 180 });
  });

  it("uses colours that match the stylesheet's tokens", () => {
    expect(data.background_color).toBe(light.background);
    expect(data.theme_color).toBe(light.primary);
    expect(pwaColors.background).toBe(light.background);
    expect(pwaColors.primary).toBe(light.primary);
    expect(pwaColors.darkBackground).toBe(dark.background);
  });
});
