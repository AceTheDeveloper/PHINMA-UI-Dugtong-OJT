import type { Metadata } from "next";
import Image from "next/image";
import { RotateCw, WifiOff } from "lucide-react";
import { focusStyle } from "@/components/brand-link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Offline · Dugtong OJT",
  robots: { index: false, follow: false },
};

// What the service worker (public/sw.js) shows when a page cannot be fetched. It
// is a plain static page with no OJT data, so it is safe to keep in the cache and
// to show to anyone, signed in or not. Time in and approvals use the server's
// clock, so they never work offline.
export default function OfflinePage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-[linear-gradient(180deg,var(--page-wash),transparent)] px-6 py-16 text-center">
      <div className="w-full max-w-[460px]">
        <Image
          src="/dugtong-mark.png"
          alt=""
          width={56}
          height={56}
          className="mx-auto size-14 object-contain"
          priority
        />
        <WifiOff aria-hidden="true" className="mx-auto mt-8 size-6 text-faint" />
        <h1 className="mt-3 font-heading text-[clamp(32px,7vw,44px)] font-extrabold leading-[1.1] tracking-[-0.04em] text-ink">
          You&apos;re offline
        </h1>
        <p className="mx-auto mt-4 max-w-[400px] text-base leading-[1.65] text-copy-muted">
          Time in and approvals need a connection. Connect to the internet, then try again.
        </p>
        {/* A plain link to this same address, not a script: with no signal the page's
            scripts may not have loaded, and the worker shows this page at the
            address the person asked for, so following it asks the network again. */}
        <a
          href=""
          className={cn(
            buttonVariants({ size: "lg" }),
            "mt-8 h-12 rounded-lg px-5 text-[15px] font-semibold",
            focusStyle,
          )}
        >
          <RotateCw aria-hidden="true" data-icon="inline-start" />
          Try again
        </a>
      </div>
    </main>
  );
}
