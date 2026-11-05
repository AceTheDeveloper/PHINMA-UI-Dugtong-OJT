import { readFileSync } from "node:fs";
import { seedFile, type SeedIds } from "./env.ts";

// The ids the seed wrote. Read inside a test, not when the file loads: Playwright
// collects every spec before the setup project has run the seed.
export function readSeedIds(): SeedIds {
  return JSON.parse(readFileSync(seedFile, "utf8")) as SeedIds;
}
