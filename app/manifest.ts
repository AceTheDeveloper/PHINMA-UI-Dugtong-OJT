import type { MetadataRoute } from "next";
import { pwaColors } from "@/lib/pwa/colors";

// The web app manifest, served at /manifest.webmanifest. A manifest cannot use
// CSS variables, so its colours come from lib/pwa/colors.ts, which a test keeps
// in step with the tokens in app/globals.css. It is public because the browser
// fetches it before sign-in, and holds no OJT data.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dugtong OJT",
    short_name: "Dugtong",
    description: "Log your OJT hours and daily journal, and get them approved the same day.",
    // Sends each role to their home, and a signed-out person to sign-in.
    start_url: "/after-sign-in",
    scope: "/",
    display: "standalone",
    background_color: pwaColors.background,
    theme_color: pwaColors.primary,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
