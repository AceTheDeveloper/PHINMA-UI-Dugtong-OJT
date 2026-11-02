"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { maxSearchLength } from "@/lib/applications/schemas";

// Search as you type: the list follows the box a moment after the last key, with
// no Search button. The server still reads and cleans the search word; this only
// puts it in the address. The X empties the box and shows every listing again.

export function ListingSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initial);
  const last = useRef(initial);

  useEffect(() => {
    const word = value.trim();
    if (word === last.current) return;
    const timer = window.setTimeout(() => {
      last.current = word;
      router.replace(word ? `${pathname}?q=${encodeURIComponent(word)}` : pathname, { scroll: false });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [value, pathname, router]);

  return (
    <div role="search" className="relative w-full sm:max-w-sm">
      <label htmlFor="listing-search" className="sr-only">
        Search by company or title
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        id="listing-search"
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        maxLength={maxSearchLength}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search by company or title"
        className="h-11 w-full pl-9 pr-11"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setValue("")}
          className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
