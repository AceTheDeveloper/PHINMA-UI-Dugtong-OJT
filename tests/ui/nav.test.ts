import { describe, expect, it } from "vitest";
import { roles } from "@/lib/auth/roles";
import { currentLabel, initials, isCurrentLink, linksFor, roleLabels } from "@/lib/nav";

describe("links per role", () => {
  it("keeps every role inside its own part of the app", () => {
    for (const role of roles) {
      for (const item of linksFor(role)) {
        if (item.href === null) continue;
        expect(item.href === `/${role}` || item.href.startsWith(`/${role}/`)).toBe(true);
      }
    }
  });

  it("gives every role a first link to land on, no duplicates, and a label", () => {
    for (const role of roles) {
      const items = linksFor(role);
      expect(items[0].href).toBe(`/${role}`);
      const hrefs = items.flatMap((item) => (item.href ? [item.href] : []));
      expect(new Set(hrefs).size).toBe(hrefs.length);
      expect(roleLabels[role].length).toBeGreaterThan(0);
    }
  });

  it("lists the student's five tabs in order", () => {
    expect(linksFor("student").map((item) => item.label)).toEqual([
      "Home",
      "Daily log",
      "Listings",
      "Applications",
      "Resume",
    ]);
  });

  it("keeps links with no screen yet as rows without a link", () => {
    const soon = linksFor("coordinator").filter((item) => item.href === null);
    expect(soon.map((item) => item.label)).toContain("Students");
    expect(linksFor("supervisor").every((item) => item.href !== null)).toBe(true);
  });
});

describe("current page", () => {
  const supervisor = linksFor("supervisor");

  it("marks the exact home link only on the home page", () => {
    expect(currentLabel("/supervisor", supervisor)).toBe("Home");
    expect(currentLabel("/supervisor/listings", supervisor)).toBe("Listings");
  });

  it("matches pages below a section", () => {
    expect(currentLabel("/supervisor/applicants/abc", supervisor)).toBe("Applicants");
    expect(currentLabel("/supervisor/approvals", supervisor)).toBe("Daily approval");
    expect(currentLabel("/supervisor/evaluations/abc", supervisor)).toBe("Evaluations");
    expect(currentLabel("/supervisor/students", supervisor)).toBe("Students");
    expect(currentLabel("/supervisor/students/abc", supervisor)).toBe("Students");
    expect(isCurrentLink("/student/listings/abc", { href: "/student/listings", label: "Listings", exact: false })).toBe(true);
  });

  it("returns null for a page outside the links", () => {
    expect(currentLabel("/supervisor/unknown", supervisor)).toBeNull();
  });
});

describe("initials", () => {
  it("uses the first and last word of a name", () => {
    expect(initials("Ana Reyes")).toBe("AR");
    expect(initials("Maria Clara de los Santos")).toBe("MS");
  });

  it("uses one letter for one word or an email", () => {
    expect(initials("ana")).toBe("A");
    expect(initials("ana@school.edu")).toBe("A");
  });

  it("falls back to a question mark for nothing", () => {
    expect(initials("   ")).toBe("?");
  });
});
