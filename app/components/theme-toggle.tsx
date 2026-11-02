"use client";

import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";

const themeStorageKey = "dugtong-theme";

function syncThemeWithPreference() {
  const preference = window.localStorage.getItem(themeStorageKey);
  const followsSystem = preference !== "light" && preference !== "dark";
  const prefersDark = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches;

  document.documentElement.classList.toggle(
    "dark",
    preference === "dark" || (followsSystem && prefersDark),
  );
}

export default function ThemeToggle() {
  useEffect(() => {
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    syncThemeWithPreference();
    colorScheme.addEventListener("change", syncThemeWithPreference);

    return () => {
      colorScheme.removeEventListener("change", syncThemeWithPreference);
    };
  }, []);

  function toggleTheme() {
    const nextPreference = document.documentElement.classList.contains("dark")
      ? "light"
      : "dark";

    window.localStorage.setItem(themeStorageKey, nextPreference);
    document.documentElement.classList.toggle(
      "dark",
      nextPreference === "dark",
    );
  }

  return (
    <button
      type="button"
      aria-label="Toggle light and dark mode"
      onClick={toggleTheme}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border-strong bg-background text-foreground transition-colors duration-150 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <Sun className="size-4 dark:hidden" aria-hidden="true" />
      <Moon className="hidden size-4 dark:block" aria-hidden="true" />
    </button>
  );
}
