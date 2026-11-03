// The maths behind the hours chain: a row of linked squares, one per 40 approved
// hours, filled as hours are approved. The 40 hours is only a unit for the
// picture, not a business rule. Long programmes get bigger links so the chain
// never grows past maxLinks.

export const hoursPerLink = 40;
export const maxLinks = 60;

export type HoursChain = {
  // Number of links in the chain (0 when the required hours are not known).
  links: number;
  // Links that are completely filled.
  filled: number;
  // How much of the current link is filled, from 0 up to (not including) 1.
  partial: number;
  // Index of the link in progress, or null when nothing is left to fill.
  current: number | null;
  complete: boolean;
  percent: number;
  // Text for screen readers and captions, for example "212 of 486 hours".
  label: string;
};

function hoursText(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function computeChain(approvedHours: number, requiredHours: number): HoursChain {
  const approved = Number.isFinite(approvedHours) ? Math.max(0, approvedHours) : 0;
  const required = Number.isFinite(requiredHours) ? Math.max(0, requiredHours) : 0;
  const label = `${hoursText(approved)} of ${hoursText(required)} hours`;

  if (required === 0) {
    return { links: 0, filled: 0, partial: 0, current: null, complete: false, percent: 0, label };
  }

  const unit = Math.max(hoursPerLink, required / maxLinks);
  const links = Math.max(1, Math.ceil(required / unit - 1e-9));
  const counted = Math.min(approved, required);
  const progress = counted / unit;
  const complete = counted >= required;
  const filled = complete ? links : Math.min(links, Math.floor(progress + 1e-9));
  const partial = complete ? 0 : Math.min(0.999, Math.max(0, progress - filled));

  return {
    links,
    filled,
    partial,
    current: complete ? null : filled,
    complete,
    percent: Math.round((counted / required) * 100),
    label,
  };
}

// The drawing of the chain. One SVG, measured in its own units and scaled to fit
// the space it is given, so a chain of any length stays on one line: 13 links on
// a 390 px phone, or 3 links in a small card, without wrapping into a second row.
export const linkSize = 26;
export const linkStep = 19; // distance between the left edges of two links
export const linkDrop = 5; // every other link sits a little lower: the chain zigzags
export const linkRadius = 8;

// Room around the drawing for the line width and the teal dot on the live link,
// which sticks out past the top right corner of its square.
const padX = 5;
const padTop = 7;
const padBottom = 3;

export type ChainGeometry = {
  width: number;
  height: number;
  links: { x: number; y: number }[];
};

export function chainGeometry(links: number): ChainGeometry {
  const count = Math.max(0, Math.floor(links));
  const placed = Array.from({ length: count }, (_, index) => ({
    x: padX + index * linkStep,
    y: padTop + (index % 2 === 1 ? linkDrop : 0),
  }));
  if (count === 0) return { width: 0, height: 0, links: [] };
  return {
    width: padX * 2 + (count - 1) * linkStep + linkSize,
    height: padTop + padBottom + linkSize + (count > 1 ? linkDrop : 0),
    links: placed,
  };
}
