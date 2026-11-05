"use client";

import { useEffect } from "react";

// Registers the service worker in production (ticket-35). The build id is in the
// script's URL, so a new deploy is a new script and the browser installs it on
// the next launch. A failure to register only means the app is not installable;
// nothing else depends on it.
export function RegisterServiceWorker({ version }: { version: string }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register(`/sw.js?v=${encodeURIComponent(version)}`, { scope: "/" })
      .catch(() => {});
  }, [version]);
  return null;
}
