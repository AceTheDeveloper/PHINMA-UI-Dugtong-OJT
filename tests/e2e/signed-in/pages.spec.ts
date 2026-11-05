import { expect, test } from "@playwright/test";
import {
  expectKeyboardStart,
  expectMainControlFocusable,
  expectNoAccessibilityViolations,
  expectNoSidewaysScroll,
  expectNotAnErrorPage,
  schemes,
  settle,
  signedInContext,
  sizes,
} from "../support/checks.ts";
import type { E2eRole, SeedIds } from "../support/env.ts";
import { readSeedIds } from "../support/seed-ids.ts";

// Every signed-in screen of the coordinator, the supervisors, and the student, at
// 390 and 1440 px, in light and dark (ticket-36). Each one must load, say what it
// is, not scroll sideways, be reachable with the keyboard with a visible focus
// ring, and pass the contrast and label checks. The admin's screens are not here:
// an admin must sign in with Google, which a test user cannot do.

type Screen = {
  role: E2eRole;
  name: string;
  path: (ids: SeedIds) => string;
  // A control this screen is for, which must be visible. ("Import roster" is a
  // link that the Button component exposes as a button.)
  action?: { role: "button" | "link"; name: string | RegExp };
};

const fixed = (path: string) => () => path;

const screens: Screen[] = [
  // Student
  { role: "student", name: "home", path: fixed("/student") },
  { role: "student", name: "daily log", path: fixed("/student/logs") },
  { role: "student", name: "listings", path: fixed("/student/listings") },
  { role: "student", name: "applications", path: fixed("/student/applications") },
  { role: "student", name: "resume", path: fixed("/student/resume") },
  { role: "student", name: "certification", path: fixed("/student/certification") },

  // Supervisor (the company owner)
  { role: "supervisorOwner", name: "home", path: fixed("/supervisor") },
  { role: "supervisorOwner", name: "listings", path: fixed("/supervisor/listings") },
  { role: "supervisorOwner", name: "daily approval", path: fixed("/supervisor/approvals"), action: { role: "button", name: "Approve" } },
  { role: "supervisorOwner", name: "applicants", path: fixed("/supervisor/applicants") },
  { role: "supervisorOwner", name: "students", path: fixed("/supervisor/students"), action: { role: "link", name: "Export CSV" } },
  { role: "supervisorOwner", name: "student", path: (ids) => `/supervisor/students/${ids.deploymentId}` },
  { role: "supervisorOwner", name: "evaluations", path: fixed("/supervisor/evaluations") },
  { role: "supervisorOwner", name: "evaluation", path: (ids) => `/supervisor/evaluations/${ids.deploymentId}` },
  { role: "supervisorOwner", name: "team", path: fixed("/supervisor/team"), action: { role: "button", name: "Invite supervisor" } },

  // Supervisor (a colleague, not the owner)
  { role: "supervisor", name: "home", path: fixed("/supervisor") },
  { role: "supervisor", name: "team", path: fixed("/supervisor/team") },

  // Coordinator
  { role: "coordinator", name: "dashboard", path: fixed("/coordinator"), action: { role: "button", name: "Import roster" } },
  { role: "coordinator", name: "students", path: fixed("/coordinator/students") },
  { role: "coordinator", name: "student", path: (ids) => `/coordinator/students/${ids.studentId}` },
  { role: "coordinator", name: "companies", path: fixed("/coordinator/companies") },
  { role: "coordinator", name: "company", path: (ids) => `/coordinator/companies/${ids.companyId}` },
  { role: "coordinator", name: "daily logs", path: fixed("/coordinator/logs") },
  { role: "coordinator", name: "evaluations", path: fixed("/coordinator/evaluations") },
  { role: "coordinator", name: "certifications", path: fixed("/coordinator/certifications") },
  { role: "coordinator", name: "roster import", path: fixed("/coordinator/roster") },
  { role: "coordinator", name: "audit log", path: fixed("/coordinator/audit") },
];

for (const scheme of schemes) {
  for (const size of sizes) {
    for (const screen of screens) {
      test(`${screen.role}: ${screen.name} on a ${size.name} in ${scheme}`, async ({ browser }) => {
        const context = await signedInContext(browser, screen.role, size, scheme);
        const page = await context.newPage();
        const path = screen.path(readSeedIds());

        const response = await page.goto(path, { waitUntil: "load" });
        expect(response?.status(), "status").toBeLessThan(400);
        await settle(page);

        // It is the screen asked for, in the theme asked for.
        expect(new URL(page.url()).pathname, "no redirect").toBe(path);
        await expect
          .poll(() => page.evaluate(() => document.documentElement.classList.contains("dark")), { message: "the dark class matches the theme" })
          .toBe(scheme === "dark");
        await expect(page.locator("h1").first()).toBeVisible();
        await expectNotAnErrorPage(page);

        await expectNoSidewaysScroll(page);

        // From the top of the page, the first Tab lands on something that shows it.
        await expectKeyboardStart(page);
        if (screen.action) {
          const action = page.getByRole(screen.action.role, { name: screen.action.name }).first();
          await expect(action, "the screen's main control").toBeVisible();
          await action.focus();
          await expect(action).toBeFocused();
        }
        await expectMainControlFocusable(page);

        await expectNoAccessibilityViolations(page, `${screen.role} ${path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, "[id]")}`);

        await page.screenshot({
          path: `test-results/shots/${screen.role}-${screen.name.replace(/ /g, "-")}-${size.name}-${scheme}.png`,
          fullPage: true,
        });
        await context.close();
      });
    }
  }
}

test.describe("who sees the owner's controls on Team", () => {
  test("the owner can invite, resend, and revoke; a colleague cannot", async ({ browser }) => {
    const owner = await signedInContext(browser, "supervisorOwner", sizes[1], "light");
    const ownerPage = await owner.newPage();
    await ownerPage.goto("/supervisor/team");
    await expect(ownerPage.getByRole("button", { name: "Invite supervisor" })).toBeVisible();

    const colleague = await signedInContext(browser, "supervisor", sizes[1], "light");
    const colleaguePage = await colleague.newPage();
    await colleaguePage.goto("/supervisor/team");
    await expect(colleaguePage.getByRole("heading", { level: 1, name: "Team" })).toBeVisible();
    await expect(colleaguePage.getByRole("button", { name: "Invite supervisor" })).toHaveCount(0);
    await expect(colleaguePage.getByRole("button", { name: /Resend invitation|Revoke invitation/ })).toHaveCount(0);
    await expect(colleaguePage.getByText(/Ask E2E Owner Supervisor, the owner, to invite a colleague/)).toBeVisible();
    await owner.close();
    await colleague.close();
  });
});
