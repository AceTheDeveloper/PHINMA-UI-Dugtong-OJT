"use client";

import { useEffect } from "react";

// Placed on the sign-in screen, where every sign-out ends (and where an expired
// session lands), so a shared phone keeps nothing from the last person
// (ticket-35). The worker only ever holds static files and the offline page, so
// this is a second lock, not the first.
export function ClearOfflineCaches() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
      .then((registration) => registration.active?.postMessage({ type: "clear-caches" }))
      .catch(() => {});
  }, []);
  return null;
}
