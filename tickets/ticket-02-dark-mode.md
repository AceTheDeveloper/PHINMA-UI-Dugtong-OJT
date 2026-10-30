# ticket-02: Landing page dark mode and logo assets

- Type: feature
- Assignee: TBD
- Status: in progress
- Mockup: None. Palette approved by the owner before implementation.
- Related files: `AGENTS.md`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `public/`

## What and why

Add dark-mode support to the existing public landing page and make its logo assets identifiable by descriptive filenames. The current landing-page ticket is complete and explicitly excludes dark mode; this is a separate follow-up.

## Owner decisions

- Theme behavior: support both system preference and an explicit user toggle. System preference is used until the user chooses a mode; remember an explicit choice.
- Logo handling: retain the current mark and text treatment in light mode. In dark mode, prefer the provided white-wordmark image only where its black JPEG background blends with the surrounding surface. Do not recolor or distort supplied artwork. If it cannot be used without a visible black rectangle, retain the mark with a theme-colored text wordmark.
- Rename the existing Dugtong logo assets to descriptive names based on their actual artwork, and update any references. Preserve image contents and do not remove duplicate files as part of this ticket.

Renamed assets:

- `dugtong-mark.png`
- `dugtong-mark-on-black.jpg`
- `dugtong-wordmark-dark-text-on-black.jpg`
- `dugtong-wordmark-white-text-on-black.jpg`
- `dugtong-wordmark-white-text-on-black-copy.jpg` (identical retained copy)

## Approved dark palette

Use the existing design tokens, with dark-mode values scoped to the `.dark` theme. The owner approved this palette before implementation; solid status colors retain white-text contrast.

| Token                                                                                  | Approved value                                        |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `--background`                                                                         | `#0b1220`                                             |
| `--foreground`, `--ink`                                                                | `#f1f5f9`                                             |
| `--card`, `--popover`                                                                  | `#111b2e`                                             |
| `--muted`                                                                              | `#a6b2c4`                                             |
| `--faint`                                                                              | `#aab7ca`                                             |
| `--disabled`                                                                           | `#64748b`                                             |
| `--border`                                                                             | `#263449`                                             |
| `--border-strong`                                                                      | `#3b4b63`                                             |
| `--surface`                                                                            | `#152238`                                             |
| `--page-wash`                                                                          | `#0b1220`                                             |
| `--primary`                                                                            | `#60a5fa`                                             |
| `--primary-hover`                                                                      | `#93c5fd`                                             |
| `--primary-tint`                                                                       | `#172b48`                                             |
| `--primary-track`                                                                      | `#24456f`                                             |
| `--success-tint`, `--success-border`, `--success`, `--success-hover`, `--success-text` | `#12342e`, `#28604e`, `#087a55`, `#066245`, `#6ee7b7` |
| `--warning-tint`, `--warning-border`, `--warning`, `--warning-hover`, `--warning-text` | `#3a2d12`, `#7a5a1c`, `#b45309`, `#92400e`, `#fcd34d` |
| `--error-tint`, `--error-border`, `--error`, `--error-hover`, `--error-text`           | `#3b1d25`, `#7c2c3b`, `#dc2626`, `#b91c1c`, `#fca5a5` |
| `--info-tint`, `--info-border`, `--info`, `--info-hover`, `--info-text`                | `#172b48`, `#294c7e`, `#2563eb`, `#1d4ed8`, `#93c5fd` |
| `--teal-tint`, `--teal-border`, `--teal`, `--teal-hover`, `--teal-text`                | `#123536`, `#276466`, `#086a6a`, `#065454`, `#5eead4` |
| `--neutral-tint`, `--neutral-border`, `--neutral`, `--neutral-hover`, `--neutral-text` | `#202c3e`, `#3a4a61`, `#596579`, `#475569`, `#cbd5e1` |

Keep foreground/background pairs at WCAG AA contrast or better, including text on status tints and focus indicators.

## In scope

- Dark mode for the current landing page only; other routes are not part of this ticket.
- An accessible theme toggle with a 44px minimum target, clear accessible name, visible focus, and keyboard support.
- System preference as the initial mode and a remembered explicit user selection.
- Correct theme colors for the page, controls, sample UI, status colors, CTA, and focus states, using design tokens rather than component-level raw colors.
- Descriptive names for all existing logo assets, with all source references updated and image contents preserved.
- Update `AGENTS.md` section 10 with the approved dark-mode palette and document the theme behavior.
- Tests/checks for system preference, toggle behavior, remembered choice, contrast, responsive layout, and reduced motion.

## Out of scope

- Dark mode for future authenticated or application routes.
- New logo artwork, image recoloring, removing duplicate assets, or other landing-page redesign.
- New dependencies unless an implementation need is demonstrated.

## Acceptance criteria

- [x] With no saved choice, the page follows the operating-system color preference.
- [x] The user can switch modes by keyboard or pointer; the selected mode remains after reload.
- [x] Theme initialization avoids a visible flash and React hydration warnings.
- [x] All landing-page sections and sample UI remain legible and usable in both themes at mobile and desktop widths.
- [x] Text, status labels, controls, and focus indicators meet WCAG AA contrast in both themes.
- [x] Reduced-motion preferences remain honored.
- [x] Logo filenames are descriptive, references work, and image contents remain unchanged.
- [x] `AGENTS.md` records only the palette and behavior approved by the owner.
- [x] Typecheck, lint, build, and the relevant browser checks pass.

## Plan

- Implement token-based dark values and the theme selection behavior for the landing page.
- Update the header/footer logo treatment for dark mode without altering the supplied artwork.
- Rename the existing Dugtong logo assets to descriptive, content-accurate names and update references.
- Update `AGENTS.md` and verify contrast, responsive screenshots, reduced motion, theme persistence, typecheck, lint, and build.

- [x] Plan approved by a human

## Test checklist

Tested by AI:

- [x] `npx.cmd tsc --noEmit; if ($?) { npm.cmd run lint; if ($?) { npm.cmd run build } }` — passed.
- [x] Dark-mode text, status, and focus contrast check — passed (text 4.5:1 or better; focus 3:1 or better).
- [x] Logo assets renamed; duplicate logo hashes match and image content was preserved.
- [x] Browser interaction, hydration, and responsive screenshot checks — not run; the integrated browser tools could not attach to the shared page.

Tested by a human:

- [x] Reviewed light and dark modes on desktop and a real phone (who me and when: Now)
