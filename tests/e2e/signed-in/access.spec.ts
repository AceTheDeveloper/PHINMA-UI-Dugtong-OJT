import { expect, test } from "@playwright/test";
import { settle, signedInContext, sizes } from "../support/checks.ts";
import { roleHome, type E2eRole, type SeedIds } from "../support/env.ts";
import { readSeedIds } from "../support/seed-ids.ts";

// Who may open what (ticket-36; AGENTS.md section 8: every access rule has a
// test). A page of another role, a file of another company, and a student's DTR
// that is not theirs are all refused, and a refusal looks the same as a page that
// does not exist.

const desktop = sizes[1];

// A browser signed in as the role, with its session fresh. Clerk's session token
// lasts about a minute and only a page can renew it, so a bare request with a
// saved session can be taken for a signed-out visitor (a redirect to sign-in).
// Opening the role's home first renews it, as it would for a person.
async function open(browser: Parameters<typeof signedInContext>[0], role: E2eRole) {
  const context = await signedInContext(browser, role, desktop, "light");
  const page = await context.newPage();
  await page.goto(roleHome[role].home, { waitUntil: "load" });
  await settle(page);
  return { context, page };
}

// A file request that must not be followed anywhere: a redirect to sign-in would
// otherwise look like a page that loaded.
const get = (context: Awaited<ReturnType<typeof open>>["context"], path: string) =>
  context.request.get(path, { maxRedirects: 0 });

// A page that refuses answers with the not-found screen.
async function expectRefusedPage(page: import("@playwright/test").Page, path: string) {
  await page.goto(path, { waitUntil: "load" });
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" }), path).toBeVisible();
}

const pagesOutsideEachRole: Record<E2eRole, string[]> = {
  student: ["/supervisor", "/supervisor/approvals", "/coordinator", "/coordinator/students", "/coordinator/audit", "/admin", "/admin/people"],
  supervisorOwner: ["/student", "/student/logs", "/coordinator", "/coordinator/students", "/admin", "/admin/companies"],
  supervisor: ["/student", "/coordinator", "/coordinator/logs", "/admin", "/admin/people"],
  coordinator: ["/student", "/student/logs", "/supervisor", "/supervisor/approvals", "/supervisor/team", "/admin", "/admin/academics"],
};

for (const [role, paths] of Object.entries(pagesOutsideEachRole) as [E2eRole, string[]][]) {
  test(`${role} is refused every page of the other roles`, async ({ browser }) => {
    const { context, page } = await open(browser, role);
    for (const path of paths) await expectRefusedPage(page, path);
    await context.close();
  });
}

test.describe("files", () => {
  const exportsOf: Record<E2eRole, { refused: string[]; allowed?: string }> = {
    student: { refused: ["/coordinator/export", "/supervisor/export"] },
    supervisorOwner: { refused: ["/coordinator/export"], allowed: "/supervisor/export" },
    supervisor: { refused: ["/coordinator/export"], allowed: "/supervisor/export" },
    coordinator: { refused: ["/supervisor/export"], allowed: "/coordinator/export" },
  };

  for (const [role, files] of Object.entries(exportsOf) as [E2eRole, { refused: string[]; allowed?: string }][]) {
    test(`${role}: CSV exports`, async ({ browser }) => {
      const { context } = await open(browser, role);
      for (const path of files.refused) {
        const response = await get(context, path);
        expect(response.status(), path).toBe(404);
      }
      if (files.allowed) {
        const response = await get(context, files.allowed);
        expect(response.status(), files.allowed).toBe(200);
        expect(response.headers()["content-type"]).toContain("text/csv");
        expect(response.headers()["cache-control"]).toContain("no-store");
      }
      await context.close();
    });
  }

  test("a supervisor's CSV holds only their own company's students", async ({ browser }) => {
    const { context } = await open(browser, "supervisorOwner");
    const text = await (await get(context, "/supervisor/export")).text();
    expect(text).toContain("E2E Student");
    expect(text).not.toContain("E2E Other Student");
    await context.close();
  });

  test("a student's DTR is theirs alone; the supervisor and coordinator see their own scope", async ({ browser }) => {
    const ids: SeedIds = readSeedIds();
    const own = `/dtr/${ids.deploymentId}/pdf`;
    const other = `/dtr/${ids.otherDeploymentId}/pdf`;

    const student = await open(browser, "student");
    const ownResponse = await get(student.context, own);
    expect(ownResponse.status()).toBe(200);
    expect(ownResponse.headers()["content-type"]).toContain("application/pdf");
    expect((await get(student.context, other)).status(), "another student's DTR").toBe(404);
    await student.context.close();

    const owner = await open(browser, "supervisorOwner");
    expect((await get(owner.context, own)).status()).toBe(200);
    expect((await get(owner.context, other)).status(), "another company's student").toBe(404);
    await owner.context.close();

    const coordinator = await open(browser, "coordinator");
    expect((await get(coordinator.context, own)).status()).toBe(200);
    expect((await get(coordinator.context, other)).status()).toBe(200);
    await coordinator.context.close();
  });
});

test.describe("scope: one company, one student", () => {
  test("a supervisor cannot open another company's student", async ({ browser }) => {
    const ids = readSeedIds();
    const { context, page } = await open(browser, "supervisorOwner");
    await page.goto(`/supervisor/students/${ids.otherDeploymentId}`, { waitUntil: "load" });
    await expect(page.getByText(/not found/i).first()).toBeVisible();
    await expect(page.getByText("E2E Other Student")).toHaveCount(0);
    await page.goto(`/supervisor/evaluations/${ids.otherDeploymentId}`, { waitUntil: "load" });
    await expect(page.getByText("E2E Other Student")).toHaveCount(0);
    await context.close();
  });

  test("a supervisor's list holds their own company's students only", async ({ browser }) => {
    const { context, page } = await open(browser, "supervisorOwner");
    await page.goto("/supervisor/students", { waitUntil: "load" });
    await expect(page.getByText("E2E Student").first()).toBeVisible();
    await expect(page.getByText("E2E Other Student")).toHaveCount(0);
    await context.close();
  });

  test("a student's pages hold only their own records", async ({ browser }) => {
    const { context, page } = await open(browser, "student");
    for (const path of ["/student", "/student/logs", "/student/applications"]) {
      await page.goto(path, { waitUntil: "load" });
      await expect(page.getByText("E2E Other Student")).toHaveCount(0);
      await expect(page.getByText("E2E Applicant")).toHaveCount(0);
    }
    await context.close();
  });

  test("a supervisor cannot read another company's applicants", async ({ browser }) => {
    const { context, page } = await open(browser, "supervisor");
    await page.goto("/supervisor/applicants", { waitUntil: "load" });
    await expect(page.getByText("E2E Other Student")).toHaveCount(0);
    await context.close();
  });
});

test.describe("signed out", () => {
  for (const path of ["/student", "/supervisor", "/coordinator", "/admin", "/student/logs"]) {
    test(`${path} sends a visitor to sign-in`, async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(path, { waitUntil: "load" });
      await expect(page).toHaveURL(/\/sign-in/);
      await context.close();
    });
  }

  test("files and exports are not given to a visitor", async ({ browser }) => {
    const ids = readSeedIds();
    const context = await browser.newContext();
    for (const path of ["/coordinator/export", "/supervisor/export", `/dtr/${ids.deploymentId}/pdf`]) {
      const response = await context.request.get(path, { maxRedirects: 0 });
      expect([307, 401, 404], `${path} answered ${response.status()}`).toContain(response.status());
      expect(response.headers()["content-type"] ?? "").not.toMatch(/csv|pdf/);
    }
    await context.close();
  });
});
