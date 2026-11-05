import { defineConfig } from "@playwright/test";
import { readTestUsers } from "./tests/e2e/support/env.ts";

// Browser tests. Run `npm run build` first: the tests start the built app on port
// 3100 (or reuse one that is already running there).
//
// Two kinds:
//  - "public": the pages anyone can open (smoke.spec.ts, pwa.spec.ts).
//  - "signed-in": every screen of the coordinator, the supervisors, and the
//    student, signed in with Clerk's testing tokens (ticket-36). They need the
//    four test users in .env.local (see .env.example) and write E2E-named test
//    rows to the database in .env.local. Without the users, only "public" runs.

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local (for example CI): the variables come from the environment
}

const signedIn = readTestUsers();
if (!signedIn.ok) {
  console.log(`Signed-in browser tests are off: ${signedIn.reason}`);
}

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3100" },
  webServer: {
    command: "npm run start -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: "public", testMatch: ["smoke.spec.ts", "pwa.spec.ts"] },
    ...(signedIn.ok
      ? [
          { name: "setup", testMatch: "auth.setup.ts" },
          {
            name: "signed-in",
            testMatch: "signed-in/*.spec.ts",
            dependencies: ["setup"],
            timeout: 60_000,
          },
        ]
      : []),
  ],
});
