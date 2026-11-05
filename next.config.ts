import type { NextConfig } from "next";

// Names the build for the service worker URL (public/sw.js), so each deploy is a
// new worker. Read at build time and inlined, so it stays the same until the
// next build.
const serviceWorkerVersion =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? Date.now().toString(36);

const nextConfig: NextConfig = {
  /* config options here */
  env: { NEXT_PUBLIC_SW_VERSION: serviceWorkerVersion },
  async headers() {
    return [
      {
        // The browser must always ask for a fresh worker, or an update never starts.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "text/javascript; charset=utf-8" },
        ],
      },
    ];
  },
  experimental: {
    agentFeedback: true,
    // A resume may be up to 2 MB; the default 1 MB limit would refuse it.
    serverActions: { bodySizeLimit: "3mb" },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
