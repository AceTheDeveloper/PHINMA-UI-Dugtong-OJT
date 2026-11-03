import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const focusStyle =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

// The Dugtong mark and wordmark, linking to the landing page.
export function BrandLink({
  className,
  size = "md",
}: {
  className?: string;
  size?: "md" | "sm";
}) {
  return (
    <Link
      href="/"
      aria-label="Dugtong OJT home"
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-2.5 font-heading font-extrabold tracking-[-0.03em]",
        size === "md" ? "text-xl" : "text-base",
        focusStyle,
        className,
      )}
    >
      <Image
        src="/dugtong-mark.png"
        alt=""
        width={48}
        height={48}
        className={cn(
          "object-contain",
          size === "md" ? "size-10" : "size-8",
        )}
        priority
      />
      <span>Dugtong</span>
    </Link>
  );
}
