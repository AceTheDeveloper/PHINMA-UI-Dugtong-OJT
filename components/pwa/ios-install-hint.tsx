"use client";

import { useState, useSyncExternalStore } from "react";
import { Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { iosHintStorageKey, iosHintText, shouldShowIosHint } from "@/lib/pwa/ios-hint";

// Reads the device once in the browser. On the server it says "no", so the
// server and the first browser render match and the hint appears after hydration.
function deviceWantsHint(): boolean {
  let dismissed = false;
  try {
    dismissed = window.localStorage.getItem(iosHintStorageKey) === "1";
  } catch {
    // storage blocked: the hint shows each visit, which is better than never
  }
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return shouldShowIosHint(
    { userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints, standalone },
    dismissed,
  );
}

const subscribe = () => () => {};

// A quiet note on the student home, shown on iPhone and iPad Safari until it is
// dismissed or the app is opened from the home screen. The choice is remembered
// on the device only.
export function IosInstallHint() {
  const wanted = useSyncExternalStore(subscribe, deviceWantsHint, () => false);
  const [closed, setClosed] = useState(false);
  if (!wanted || closed) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(iosHintStorageKey, "1");
    } catch {
      // nothing to remember it with; hide it for this visit
    }
    setClosed(true);
  }

  return (
    <aside
      aria-label="Add to home screen"
      className="flex items-center gap-3 rounded-2xl border border-info-border bg-info-tint px-4 py-3 text-info-text"
    >
      <Share aria-hidden="true" className="size-5 shrink-0" />
      <p className="min-w-0 flex-1 text-sm leading-[1.5]">{iosHintText}</p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Dismiss the home screen hint"
        onClick={dismiss}
      >
        <X aria-hidden="true" />
      </Button>
    </aside>
  );
}
