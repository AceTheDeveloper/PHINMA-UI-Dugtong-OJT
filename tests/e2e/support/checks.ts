import AxeBuilder from "@axe-core/playwright";
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { authFile, type E2eRole } from "./env.ts";
import { knownIssues } from "./known-issues.ts";

// The checks every signed-in screen goes through (ticket-36), written once.

export const sizes = [
  { name: "phone", width: 390, height: 844, touch: true },
  { name: "desktop", width: 1440, height: 900, touch: false },
] as const;
export const schemes = ["light", "dark"] as const;
export type Size = (typeof sizes)[number];
export type Scheme = (typeof schemes)[number];

// A browser signed in as one test user, on a phone or a desktop, in light or dark.
// Motion is reduced so contrast is measured on settled colours.
export async function signedInContext(
  browser: Browser,
  role: E2eRole,
  size: Size,
  scheme: Scheme,
): Promise<BrowserContext> {
  return browser.newContext({
    storageState: authFile(role),
    viewport: { width: size.width, height: size.height },
    colorScheme: scheme,
    reducedMotion: "reduce",
    hasTouch: size.touch,
    isMobile: size.touch,
  });
}

export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("load");
  await page.evaluate(() => document.fonts.ready);
  // Streamed content (partial prerendering) is in once the network is quiet.
  await page.waitForLoadState("networkidle").catch(() => {});
}

export async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(0);
}

// The focused element shows an outline or a ring (the ring is a box shadow).
export async function expectFocusRing(page: Page): Promise<void> {
  const shown = await page.evaluate(() => {
    const element = document.activeElement;
    if (!element || element === document.body) return { focused: false, ring: false };
    const style = getComputedStyle(element);
    const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
    const ring = style.boxShadow !== "none" && style.boxShadow !== "";
    return { focused: true, ring: outline || ring };
  });
  expect(shown.focused, "something has keyboard focus").toBe(true);
  expect(shown.ring, "the focused element shows a focus ring").toBe(true);
}

// The first thing the keyboard reaches is visible and shows where it is.
export async function expectKeyboardStart(page: Page): Promise<void> {
  await page.keyboard.press("Tab");
  await expectFocusRing(page);
}

const controls = "main a[href], main button:not([disabled]), main input:not([type=hidden]):not([disabled]), main select, main textarea";

// The first control in the page's main area can be reached and shows a focus ring.
// Returns false when the page has no control at all (a read-only screen).
export async function expectMainControlFocusable(page: Page): Promise<boolean> {
  for (const control of await page.locator(controls).all()) {
    if (!(await control.isVisible())) continue;
    await control.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(control).toBeFocused();
    await expectFocusRing(page);
    return true;
  }
  return false;
}

// Contrast and labels, with the few known problems (each one a recorded
// follow-up) left out. Anything else fails the test.
export async function expectNoAccessibilityViolations(page: Page, key: string): Promise<void> {
  const result = await new AxeBuilder({ page })
    .withRules(["color-contrast", "label", "button-name", "link-name", "select-name"])
    .analyze();
  const allowed = new Set(knownIssues[key] ?? []);
  const found = result.violations
    .filter((violation) => !allowed.has(violation.id))
    .map((violation) => `${violation.id}: ${violation.nodes.length} element(s), for example ${violation.nodes[0]?.target.join(" ")}`);
  expect(found, `accessibility violations on ${key}`).toEqual([]);
}

export async function expectNotAnErrorPage(page: Page): Promise<void> {
  const title = await page.locator("h1").first().innerText();
  expect(title, "page heading").not.toMatch(/page not found|something went wrong/i);
}
