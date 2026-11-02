import { computeChain } from "@/lib/hours-chain";
import { cn } from "@/lib/utils";

// The signature element: a chain of linked rounded squares (the Dugtong mark),
// one per 40 approved hours. Filled links are the primary colour, the link in
// progress carries the teal dot, the rest are empty outlines. It is one image
// for assistive technology, with the hours as its text.
const sizes = {
  md: { link: "size-9 border-[3px] rounded-[11px]", overlap: "-ml-2", drop: "translate-y-1.5", dot: "size-3 -right-1 -top-1" },
  sm: { link: "size-5 border-2 rounded-[7px]", overlap: "-ml-1", drop: "translate-y-1", dot: "size-2 -right-0.5 -top-0.5" },
} as const;

export function HoursChain({
  approvedHours,
  requiredHours,
  size = "md",
  className,
}: {
  approvedHours: number;
  requiredHours: number;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const chain = computeChain(approvedHours, requiredHours);
  if (chain.links === 0) return null;
  const look = sizes[size];

  return (
    <div
      role="img"
      aria-label={chain.label}
      className={cn("flex flex-wrap items-center pb-2 pl-1 pt-1", className)}
    >
      {Array.from({ length: chain.links }, (_, index) => {
        const isFilled = index < chain.filled;
        const isCurrent = chain.current === index;
        const fraction = isCurrent ? Math.round(chain.partial * 100) : 0;
        return (
          <span
            key={index}
            aria-hidden="true"
            style={{
              animationDelay: `${Math.min(index, 24) * 35}ms`,
              ...(isCurrent && fraction > 0
                ? {
                    backgroundImage: `linear-gradient(to top, var(--primary-track) ${fraction}%, transparent ${fraction}%)`,
                  }
                : {}),
            }}
            className={cn(
              "dg-chain-link relative inline-block shrink-0",
              look.link,
              index > 0 && look.overlap,
              index % 2 === 1 && look.drop,
              isFilled
                ? "border-primary bg-primary-tint"
                : isCurrent
                  ? "border-primary"
                  : "border-border-strong",
            )}
          >
            {isCurrent ? (
              <span className={cn("absolute rounded-full bg-teal ring-2 ring-background", look.dot)} />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
