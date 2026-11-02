import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Each db test file boots its own in-memory Postgres (WebAssembly).
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
