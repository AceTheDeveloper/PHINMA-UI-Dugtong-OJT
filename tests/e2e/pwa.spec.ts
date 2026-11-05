import { expect, test } from "@playwright/test";

// The installable app (ticket-35), on a production build: the manifest, the
// worker, and the icons load without signing in; the worker takes over; with no
// signal a page shows the offline page; and a signed-in page is never answered
// from the cache. Installing on a phone and "Install app" in Chrome are human
// checks.

test("the manifest, worker, icons, and offline page load without signing in", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const body = await manifest.json();
  expect(body).toMatchObject({ name: "Dugtong OJT", display: "standalone", start_url: "/after-sign-in" });
  expect(body.icons.map((icon: { sizes: string; purpose: string }) => `${icon.sizes} ${icon.purpose}`)).toEqual([
    "192x192 any",
    "512x512 any",
    "512x512 maskable",
  ]);

  const worker = await request.get("/sw.js?v=test");
  expect(worker.status()).toBe(200);
  expect(worker.headers()["content-type"]).toContain("javascript");
  expect(worker.headers()["cache-control"]).toContain("no-cache");

  for (const icon of ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png", "/icons/apple-touch-icon.png"]) {
    const response = await request.get(icon);
    expect(response.status(), icon).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  }

  const offline = await request.get("/offline");
  expect(offline.status()).toBe(200);
  expect(await offline.text()).toContain("Time in and approvals need a connection.");
});

test("the landing page links the manifest and the Apple icon", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", /manifest\.webmanifest/);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /apple-touch-icon\.png/);
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute("content", /^#[0-9a-f]{6}$/i);
});

test("the worker takes over, shows the offline page with no signal, and keeps no signed-in page", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // The worker claims the open page once it activates.
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  // Only the offline page, the icons, and static build files are ever kept.
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const paths: string[] = [];
        for (const name of await caches.keys()) {
          for (const request of await (await caches.open(name)).keys()) paths.push(new URL(request.url).pathname);
        }
        return paths.includes("/offline");
      }),
    )
    .toBe(true);

  await context.setOffline(true);
  await page.goto("/student/logs");
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Try again" })).toBeVisible();

  // The page is styled with no signal: its stylesheet came from the cache.
  const fontFamily = await page.getByRole("heading", { name: "You're offline" }).evaluate(
    (element) => getComputedStyle(element).fontFamily,
  );
  expect(fontFamily).toContain("IBM Plex Sans");

  // Back online, the same address asks the server, which sends a signed-out
  // visitor to sign-in. Nothing was kept from before.
  await context.setOffline(false);
  await page.getByRole("link", { name: "Try again" }).click();
  await expect(page).toHaveURL(/\/sign-in/);

  const kept = await page.evaluate(async () => {
    const paths: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) paths.push(new URL(request.url).pathname);
    }
    return paths;
  });
  expect(kept.length).toBeGreaterThan(0);
  for (const path of kept) {
    expect(path === "/offline" || path.startsWith("/icons/") || path.startsWith("/_next/static/"), path).toBe(true);
  }
  await context.close();
});

for (const scheme of ["light", "dark"] as const) {
  for (const size of [
    { name: "phone", width: 390, height: 844, touch: true },
    { name: "desktop", width: 1440, height: 900, touch: false },
  ] as const) {
    test(`the offline page on a ${size.name} in ${scheme}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        colorScheme: scheme,
        hasTouch: size.touch,
        isMobile: size.touch,
      });
      const page = await context.newPage();
      await page.goto("/offline", { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);

      await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);

      const button = page.getByRole("link", { name: "Try again" });
      const box = await button.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      await button.focus();
      await expect(button).toBeFocused();
      await page.screenshot({ path: `test-results/shots/offline-${size.name}-${scheme}.png` });
      await context.close();
    });
  }
}
