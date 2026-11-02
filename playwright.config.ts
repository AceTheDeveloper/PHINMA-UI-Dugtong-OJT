import { defineConfig } from "@playwright/test";

// Browser smoke tests. Run `npm run build` first: the tests start the built app
// on port 3100 (or reuse one that is already running there).
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3100" },
  webServer: {
    command: "npm run start -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
