import ScrollReveal from "./components/scroll-reveal";
import {
  FinalCta,
  Hero,
  Journey,
  LandingFooter,
  LandingHeader,
  Roles,
  Team,
  Trust,
} from "@/components/landing/landing-sections";
import { focusStyle } from "@/components/brand-link";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <>
      <a
        className={cn(
          "absolute left-2 top-2 z-20 -translate-y-[160%] rounded-lg bg-ink px-4 py-3 text-surface transition-transform duration-150 focus:translate-y-0 dark:bg-card dark:text-card-foreground",
          focusStyle,
        )}
        href="#main-content"
      >
        Skip to content
      </a>
      <LandingHeader />
      <ScrollReveal />
      <main id="main-content">
        <Hero />
        <Journey />
        <Roles />
        <Trust />
        <Team />
        <FinalCta />
      </main>
      <LandingFooter />
    </>
  );
}
