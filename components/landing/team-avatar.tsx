import { cn } from "@/lib/utils";

// Animated stand-in for a team photo: a gentle bob, a slight head tilt, and a
// blink. The motion stops when the visitor prefers reduced motion. The fills
// below are illustration colors, not UI tokens; keep them inside this file.

type Hair = "short" | "curly" | "side" | "cap" | "long";

type Person = {
  name: string;
  hair: Hair;
  glasses?: boolean;
  skin: string;
  skinShade: string;
  hairColor: string;
  shirt: string;
  panel: string;
  delay: number;
};

export const team: Person[] = [
  {
    name: "Ace",
    hair: "short",
    skin: "#f1c9a5",
    skinShade: "#d9a67c",
    hairColor: "#1f2937",
    shirt: "#2563eb",
    panel: "bg-primary-tint",
    delay: 0,
  },
  {
    name: "Josiah",
    hair: "curly",
    skin: "#c68642",
    skinShade: "#a9703c",
    hairColor: "#111827",
    shirt: "#086a6a",
    panel: "bg-teal-tint",
    delay: 0.7,
  },
  {
    name: "Neil",
    hair: "side",
    glasses: true,
    skin: "#8d5524",
    skinShade: "#7a4a1e",
    hairColor: "#2b2118",
    shirt: "#087a55",
    panel: "bg-success-tint",
    delay: 1.4,
  },
  {
    name: "Khent",
    hair: "cap",
    skin: "#e0ac69",
    skinShade: "#c98f5a",
    hairColor: "#334155",
    shirt: "#b45309",
    panel: "bg-warning-tint",
    delay: 2.1,
  },
  {
    name: "Bonnie",
    hair: "long",
    skin: "#f5d0b0",
    skinShade: "#e3b995",
    hairColor: "#5b3a1e",
    shirt: "#475569",
    panel: "bg-neutral-tint",
    delay: 2.8,
  },
];

const bob =
  "animate-[dg-bob_3.6s_ease-in-out_infinite] motion-reduce:animate-none";
const tilt =
  "animate-[dg-tilt_6s_ease-in-out_infinite] motion-reduce:animate-none [transform-box:fill-box] origin-[50%_100%]";
const blink =
  "animate-[dg-blink_4.2s_linear_infinite] motion-reduce:animate-none [transform-box:fill-box] origin-center";

function Hairstyle({ hair, color }: { hair: Hair; color: string }) {
  switch (hair) {
    case "short":
      return (
        <path
          d="M37 54 C34 32 50 26 62 27 C80 28 86 42 83 54 C80 44 72 39 60 39 C48 39 40 44 37 54 Z"
          fill={color}
        />
      );
    case "side":
      return (
        <path
          d="M37 56 C33 32 52 24 66 27 C82 30 86 44 83 56 C82 46 76 40 66 38 C54 41 44 44 37 56 Z"
          fill={color}
        />
      );
    case "curly":
      return (
        <>
          <circle cx="47" cy="36" r="10" fill={color} />
          <circle cx="61" cy="31" r="11" fill={color} />
          <circle cx="74" cy="37" r="10" fill={color} />
          <circle cx="40" cy="46" r="7" fill={color} />
          <circle cx="81" cy="47" r="7" fill={color} />
        </>
      );
    case "cap":
      return (
        <>
          <path d="M36 50 C36 30 50 24 60 24 C72 24 84 30 84 50 Z" fill={color} />
          <path
            d="M34 50 H94 C94 54 86 56 78 56 H40 C36 56 34 53 34 50 Z"
            fill="#1e293b"
          />
        </>
      );
    case "long":
      return (
        <path
          d="M38 50 C40 36 54 32 62 33 C74 34 82 42 82 50 C74 44 66 41 58 42 C50 43 42 46 38 50 Z"
          fill={color}
        />
      );
  }
}

export function TeamAvatar({
  person,
  className,
}: {
  person: Person;
  className?: string;
}) {
  const eyeY = person.hair === "cap" ? 60 : person.hair === "long" ? 58 : 57;
  const delay = { animationDelay: `-${person.delay}s` };
  const eyeDelay = { animationDelay: `-${person.delay + 0.5}s` };

  return (
    <svg
      viewBox="0 0 120 120"
      role="img"
      aria-label={`Animated avatar of ${person.name}`}
      className={cn("size-[104px] rounded-full", person.panel, className)}
    >
      <g className={bob} style={delay}>
        <path
          d="M18 120 C20 94 38 86 60 86 C82 86 100 94 102 120 Z"
          fill={person.shirt}
        />
        {person.hair === "long" && (
          <path
            d="M34 56 C30 30 48 22 60 22 C74 22 90 30 86 56 L92 100 C80 104 40 104 28 100 Z"
            fill={person.hairColor}
          />
        )}
        <rect x="52" y="70" width="16" height="20" rx="6" fill={person.skinShade} />
        <g className={tilt} style={delay}>
          <ellipse cx="60" cy="55" rx="22" ry="25" fill={person.skin} />
          <Hairstyle hair={person.hair} color={person.hairColor} />
          <ellipse
            className={blink}
            style={eyeDelay}
            cx="51"
            cy={eyeY}
            rx="2.6"
            ry="3.2"
            fill="#0f172a"
          />
          <ellipse
            className={blink}
            style={eyeDelay}
            cx="69"
            cy={eyeY}
            rx="2.6"
            ry="3.2"
            fill="#0f172a"
          />
          {person.glasses && (
            <>
              <circle cx="51" cy={eyeY} r="7.5" fill="none" stroke="#0f172a" strokeWidth="2" />
              <circle cx="69" cy={eyeY} r="7.5" fill="none" stroke="#0f172a" strokeWidth="2" />
              <path d="M58.5 57 H61.5" stroke="#0f172a" strokeWidth="2" />
            </>
          )}
          <path
            d={`M53 ${eyeY + 10} Q60 ${eyeY + 17} 67 ${eyeY + 10}`}
            stroke="#0f172a"
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
  );
}
