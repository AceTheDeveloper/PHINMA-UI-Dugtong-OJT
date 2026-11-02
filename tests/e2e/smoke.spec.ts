import { expect, test } from "@playwright/test";

// Every public screen, on a phone and a desktop, in light and dark: it loads,
// nothing scrolls sideways, the theme matches, the new heading font is applied,
// and touch targets on a phone are tall enough. Screenshots are saved under
// test-results/shots for a human look. The signed-in screens need a Clerk
// session and are not covered here yet.

const screens = [
  { name: "landing", path: "/", heading: "Your OJT, from application to certification." },
  { name: "sign-in", path: "/sign-in", heading: "Welcome back" },
  { name: "not-found", path: "/no-such-page", heading: null },
] as const;

const sizes = [
  { name: "phone", width: 390, height: 844, touch: true },
  { name: "desktop", width: 1440, height: 900, touch: false },
] as const;

for (const scheme of ["light", "dark"] as const) {
  for (const size of sizes) {
    for (const screen of screens) {
      test(`${screen.name} on a ${size.name} in ${scheme}`, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: size.width, height: size.height },
          colorScheme: scheme,
          hasTouch: size.touch,
          isMobile: size.touch,
        });
        const page = await context.newPage();
        await page.goto(screen.path, { waitUntil: "load" });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(700);

        // The theme follows the system preference.
        await expect(page.locator("html")).toHaveClass(scheme === "dark" ? /dark/ : /^(?!.*dark).*$/);

        // Nothing scrolls sideways.
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(0);

        if (screen.heading) {
          const heading = page.getByRole("heading", { level: 1, name: screen.heading });
          await expect(heading).toBeVisible();
          // The heading font is the new one (next/font names it after the family).
          const family = await heading.evaluate((node) => getComputedStyle(node).fontFamily);
          expect(family).toMatch(/Bricolage/i);
        }

        if (size.touch && screen.name === "sign-in") {
          for (const control of await page.locator("main button, main input").all()) {
            if (!(await control.isVisible())) continue;
            const box = await control.boundingBox();
            expect(box?.height ?? 0, "touch target height").toBeGreaterThanOrEqual(43.5);
          }
        }

        await page.screenshot({
          path: `test-results/shots/${screen.name}-${size.name}-${scheme}.png`,
          fullPage: true,
        });
        await context.close();
      });
    }
  }
}
