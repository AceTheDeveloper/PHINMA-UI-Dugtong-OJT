import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "./components/theme-toggle";

const focusStyle =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--page-wash),transparent)]">
      <header className="mx-auto flex min-h-[88px] w-[min(100%_-_64px,1200px)] items-center justify-between max-sm:w-[calc(100%_-_48px)]">
        <Link
          className={`inline-flex min-h-11 items-center gap-2.5 font-heading text-[19px] font-extrabold tracking-[-0.03em] max-sm:text-[17px] ${focusStyle}`}
          href="/"
          aria-label="Dugtong OJT home"
        >
          <Image
            src="/dugtong-mark.png"
            alt=""
            width={48}
            height={48}
            className="size-10 object-contain"
            priority
          />
          <span>Dugtong</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex min-h-[calc(100svh-88px)] items-center justify-center px-6 pb-16 pt-8 text-center">
        <div className="w-full max-w-[560px]">
          <p className="mb-4 font-mono text-sm font-semibold tracking-[0.12em] text-primary">
            404
          </p>
          <h1 className="font-heading text-[clamp(38px,7vw,56px)] font-extrabold leading-[1.08] tracking-[-0.04em]">
            Page not found
          </h1>
          <p className="mx-auto mt-5 max-w-[440px] text-base leading-[1.65] text-copy-muted sm:text-lg">
            The page you&apos;re looking for doesn&apos;t exist or may have moved.
          </p>
          <Button
            nativeButton={false}
            render={<Link href="/" />}
            role="link"
            size="lg"
            className={`mt-8 h-12 rounded-lg bg-primary px-5 text-[15px] font-semibold text-primary-foreground hover:bg-primary-hover ${focusStyle}`}
          >
            <ArrowLeft aria-hidden="true" />
            Go to home page
          </Button>
        </div>
      </main>
    </div>
  );
}
