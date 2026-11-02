import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Reads the design tokens out of app/globals.css and measures the contrast of
// every pair that carries text, a badge, or a control edge, in both themes. A
// token change that breaks a pair fails here, so contrast is not checked by eye.
// Text needs 4.5:1; the edges and marks a person has to see need 3:1.

const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("\n}", start));
  const tokens: Record<string, string> = {};
  for (const match of body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) tokens[match[1]] = match[2].trim();
  return tokens;
}

const light = block(":root");
const dark = { ...light, ...block(".dark") };

function resolve(theme: Record<string, string>, name: string): string {
  let value = theme[name];
  for (let hops = 0; value?.startsWith("var(") && hops < 6; hops += 1) {
    value = theme[value.slice(6, -1)];
  }
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`--${name} is not a plain colour: ${value}`);
  return value;
}

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

const themes = { light, dark } as const;

// [text token, background token]: words and numbers, 4.5:1.
const textPairs: [string, string][] = [
  ["ink", "background"],
  ["ink", "card"],
  ["ink", "surface"],
  ["ink", "popover"],
  ["muted", "background"],
  ["muted", "card"],
  ["muted", "surface"],
  ["faint", "background"],
  ["faint", "card"],
  ["primary", "card"],
  ["primary", "background"],
  ["primary-foreground", "primary"],
  ["info-text", "info-tint"],
  ["success-text", "success-tint"],
  ["warning-text", "warning-tint"],
  ["error-text", "error-tint"],
  ["teal-text", "teal-tint"],
  ["neutral-text", "neutral-tint"],
  ["accent-foreground", "accent"],
  ["secondary-foreground", "secondary"],
  ["error-text", "card"],
  ["success-text", "card"],
  ["teal-text", "card"],
  ["info-text", "card"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-accent-foreground", "sidebar-accent"],
  ["sidebar-foreground", "sidebar-accent"],
  ["sidebar-primary", "sidebar"],
  ["deep-foreground", "deep"],
  ["deep-muted", "deep"],
  ["deep-action-foreground", "deep-action"],
  ["teal-bright", "deep"],
];

// Marks and edges a person must be able to see: 3:1.
const markPairs: [string, string][] = [
  ["primary", "card"],
  ["teal-bright", "card"],
  ["input", "card"],
  ["input", "background"],
  ["ring", "card"],
  ["teal-bright", "sidebar"],
  ["deep-action", "deep"],
];

describe.each(Object.entries(themes))("%s theme", (_name, theme) => {
  it.each(textPairs)("%s on %s is at least 4.5:1", (text, background) => {
    expect(contrast(resolve(theme, text), resolve(theme, background))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(markPairs)("%s against %s is at least 3:1", (mark, background) => {
    expect(contrast(resolve(theme, mark), resolve(theme, background))).toBeGreaterThanOrEqual(3);
  });

  it("keeps solid fills readable: white or the theme's own foreground on the filled badge colours", () => {
    const light_text = "#ffffff";
    expect(contrast(light_text, resolve(theme, "warning"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light_text, resolve(theme, "success"))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the sidebar's secondary text (the foreground at 70%) readable on the sidebar", () => {
    const foreground = resolve(theme, "sidebar-foreground");
    const ground = resolve(theme, "sidebar");
    const mix = [1, 3, 5]
      .map((offset) => {
        const a = parseInt(foreground.slice(offset, offset + 2), 16);
        const b = parseInt(ground.slice(offset, offset + 2), 16);
        return Math.round(a * 0.7 + b * 0.3)
          .toString(16)
          .padStart(2, "0");
      })
      .join("");
    expect(contrast(`#${mix}`, ground)).toBeGreaterThanOrEqual(4.5);
  });

  it("puts the destructive colour on a readable button", () => {
    const on = _name === "light" ? "#ffffff" : resolve(theme, "primary-foreground");
    expect(contrast(on, resolve(theme, "destructive"))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("the parser", () => {
  it("found both themes' tokens", () => {
    expect(Object.keys(light).length).toBeGreaterThan(40);
    expect(light.primary).toBe("#2255f2");
    expect(dark.primary).toBe("#6e93ff");
  });

  it("measures the extremes correctly", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#777777", "#777777")).toBe(1);
  });
});
