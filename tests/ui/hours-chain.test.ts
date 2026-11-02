import { describe, expect, it } from "vitest";
import {
  chainGeometry,
  computeChain,
  hoursPerLink,
  linkDrop,
  linkSize,
  linkStep,
  maxLinks,
} from "@/lib/hours-chain";
import { isCurrentLink } from "@/lib/nav";

describe("computeChain", () => {
  it("has one link per 40 required hours, rounded up", () => {
    expect(computeChain(0, 486).links).toBe(13);
    expect(computeChain(0, 480).links).toBe(12);
    expect(computeChain(0, 481).links).toBe(13);
    expect(computeChain(0, 40).links).toBe(1);
    expect(computeChain(0, 1).links).toBe(1);
  });

  it("starts empty with the first link in progress", () => {
    expect(computeChain(0, 486)).toMatchObject({
      filled: 0,
      partial: 0,
      current: 0,
      complete: false,
      percent: 0,
      label: "0 of 486 hours",
    });
  });

  it("fills whole links and part of the current one", () => {
    const chain = computeChain(212, 486);
    expect(chain.filled).toBe(5);
    expect(chain.partial).toBeCloseTo(0.3, 5);
    expect(chain.current).toBe(5);
    expect(chain.percent).toBe(44);
    expect(chain.label).toBe("212 of 486 hours");
  });

  it("puts the current link right after the last full one at an exact boundary", () => {
    const chain = computeChain(80, 486);
    expect(chain).toMatchObject({ filled: 2, partial: 0, current: 2 });
  });

  it("is complete at the required hours with no link in progress", () => {
    const chain = computeChain(486, 486);
    expect(chain).toMatchObject({ filled: 13, partial: 0, current: null, complete: true, percent: 100 });
  });

  it("caps the picture at 100 percent but keeps the real hours in the label", () => {
    const chain = computeChain(520, 486);
    expect(chain).toMatchObject({ filled: 13, current: null, complete: true, percent: 100 });
    expect(chain.label).toBe("520 of 486 hours");
  });

  it("treats negative, missing, and not-a-number hours as zero", () => {
    for (const bad of [-5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(computeChain(bad, 486)).toMatchObject({ filled: 0, current: 0, percent: 0 });
    }
  });

  it("shows no chain when the required hours are not known", () => {
    for (const bad of [0, -10, Number.NaN]) {
      expect(computeChain(100, bad)).toMatchObject({ links: 0, complete: false, current: null });
    }
  });

  it("writes part hours with one decimal", () => {
    expect(computeChain(12.5, 486).label).toBe("12.5 of 486 hours");
  });

  it("never grows past the maximum links; longer programmes get bigger links", () => {
    const chain = computeChain(1200, 4800);
    expect(chain.links).toBe(maxLinks);
    expect(chain.filled).toBe(15);
    expect(hoursPerLink).toBe(40);
  });
});

describe("isCurrentLink", () => {
  const home = { href: "/student", label: "Home", exact: true };
  const listings = { href: "/student/listings", label: "Listings", exact: false };

  it("matches the exact page only for an exact link", () => {
    expect(isCurrentLink("/student", home)).toBe(true);
    expect(isCurrentLink("/student/listings", home)).toBe(false);
  });

  it("matches the page and the pages below it, but not a sibling with the same prefix", () => {
    expect(isCurrentLink("/student/listings", listings)).toBe(true);
    expect(isCurrentLink("/student/listings/abc", listings)).toBe(true);
    expect(isCurrentLink("/student/listings-old", listings)).toBe(false);
    expect(isCurrentLink("/student/applications", listings)).toBe(false);
  });
});

describe("chainGeometry", () => {
  it("draws nothing for no links", () => {
    expect(chainGeometry(0)).toEqual({ width: 0, height: 0, links: [] });
    expect(chainGeometry(-3).links).toEqual([]);
  });

  it("places one link with no zigzag", () => {
    const one = chainGeometry(1);
    expect(one.links).toHaveLength(1);
    expect(one.height).toBe(7 + 3 + linkSize);
    expect(one.width).toBe(5 * 2 + linkSize);
  });

  it("steps each link along by the same distance and lowers every other one", () => {
    const geo = chainGeometry(13);
    expect(geo.links).toHaveLength(13);
    geo.links.forEach((link, index) => {
      expect(link.x).toBe(5 + index * linkStep);
      expect(link.y).toBe(7 + (index % 2 === 1 ? linkDrop : 0));
    });
  });

  it("is as wide as its last link reaches, so the whole chain fits one line at any scale", () => {
    for (const links of [2, 5, 13, maxLinks]) {
      const geo = chainGeometry(links);
      const last = geo.links.at(-1)!;
      expect(geo.width).toBe(last.x + linkSize + 5);
      expect(geo.height).toBe(7 + 3 + linkSize + linkDrop);
    }
  });

  it("keeps the same height however many links there are (past one), so charts and cards line up", () => {
    expect(chainGeometry(2).height).toBe(chainGeometry(60).height);
  });

  it("scales to a phone: a 486 hour chain drawn into 340 px has links of a usable size", () => {
    const geo = chainGeometry(computeChain(0, 486).links);
    const scale = 340 / geo.width;
    expect(linkSize * scale).toBeGreaterThan(24);
  });
});
