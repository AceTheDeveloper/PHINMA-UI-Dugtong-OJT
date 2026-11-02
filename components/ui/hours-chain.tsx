import {
  chainGeometry,
  computeChain,
  linkRadius,
  linkSize,
} from "@/lib/hours-chain";
import { cn } from "@/lib/utils";

// The signature element: a chain of linked rounded squares (the Dugtong mark), one
// per 40 approved hours. Filled links are the primary colour, the link in progress
// is part filled and carries the teal dot, the rest are empty outlines.
//
// It is one SVG that scales to the space it is given, so the whole chain always
// sits on one line, however many links it has and however narrow the phone. It is
// one image for assistive technology, with the hours as its text. Set
// --chain-bg on a parent to match the surface the chain sits on (it defaults to
// the card colour); the links hide each other where they overlap.

// How many screen pixels one drawing unit is, so a link is about this big at most.
const sizes = {
  md: { unit: 1.4, stroke: 3 }, // links up to about 36 px
  sm: { unit: 0.95, stroke: 2 }, // links up to about 24 px
} as const;

const surface = "var(--chain-bg, var(--card))";

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
  const geometry = chainGeometry(chain.links);
  const look = sizes[size];

  return (
    <svg
      role="img"
      aria-label={chain.label}
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      // Its natural size, shrinking to fit when the space is narrower (a phone).
      style={{
        width: geometry.width * look.unit,
        maxWidth: "100%",
        aspectRatio: `${geometry.width} / ${geometry.height}`,
      }}
      className={cn("block overflow-visible", className)}
    >
      {geometry.links.map(({ x, y }, index) => {
        const isFilled = index < chain.filled;
        const isCurrent = chain.current === index;
        const fraction = isCurrent ? chain.partial : 0;
        return (
          <g
            key={index}
            aria-hidden="true"
            className="dg-chain-link"
            style={{ animationDelay: `${Math.min(index, 24) * 35}ms` }}
          >
            <rect
              x={x}
              y={y}
              width={linkSize}
              height={linkSize}
              rx={linkRadius}
              strokeWidth={look.stroke}
              vectorEffect="non-scaling-stroke"
              className={cn(
                isFilled
                  ? "fill-primary-tint stroke-primary"
                  : isCurrent
                    ? "stroke-primary"
                    : "stroke-border-strong",
              )}
              style={isFilled ? undefined : { fill: surface }}
            />
            {isCurrent && fraction > 0 ? (
              <rect
                x={x}
                y={y}
                width={linkSize}
                height={linkSize}
                rx={linkRadius}
                className="fill-primary-track"
                style={{ clipPath: `inset(${(1 - fraction) * 100}% 0 0 0) fill-box` }}
              />
            ) : null}
          </g>
        );
      })}
      {/* The live link's dot goes last, so the next link cannot cover it. */}
      {chain.current !== null && geometry.links[chain.current] ? (
        <circle
          aria-hidden="true"
          cx={geometry.links[chain.current].x + linkSize - 2}
          cy={geometry.links[chain.current].y + 2}
          r={4.5}
          className="fill-teal-bright"
          stroke={surface}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </svg>
  );
}
