import { clerk, clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test as setup } from "@playwright/test";
import { authFile, e2eRoles, readTestUsers, roleHome } from "./support/env.ts";
import { seedE2e } from "./support/seed.ts";

// Runs before the signed-in specs (ticket-36): seeds the test data, then signs in
// as each of the four test users once and saves the browser session, so the specs
// reuse it and Clerk is not asked to sign in a hundred times. Serial, so Clerk's
// testing token (set once, in this process) is there for every sign-in.

setup.describe.configure({ mode: "serial" });

const found = readTestUsers();

setup("seed the test data and get a Clerk testing token", async () => {
  setup.setTimeout(120_000);
  const seeded = await seedE2e();
  console.log(
    `Seeded ${seeded.host} for ${seeded.ids.today}${seeded.newDeployment ? " (a new deployment was started)" : ""}.` +
      (seeded.ids.todayLocked ? " The student's entry for today is approved and locked, so the flow test will skip." : ""),
  );
  await clerkSetup();
});

for (const role of e2eRoles) {
  setup(`sign in as the ${role} test user`, async ({ page }) => {
    if (!found.ok) throw new Error(found.reason);
    await setupClerkTestingToken({ page });
    await page.goto("/sign-in");
    await clerk.signIn({ page, emailAddress: found.users[role] });
    // The same step real people take: the router that sends each role home.
    await page.goto("/after-sign-in");
    await page.waitForURL((url) => url.pathname.startsWith(roleHome[role].home), { timeout: 30_000 });
    await expect(page.locator("h1").first()).toBeVisible();
    await page.context().storageState({ path: authFile(role) });
  });
}
