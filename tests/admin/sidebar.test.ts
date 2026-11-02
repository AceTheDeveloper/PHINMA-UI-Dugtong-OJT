import { describe, expect, it } from "vitest";
import { adminNavItems } from "@/components/admin/admin-sidebar";
import { tableLabel } from "@/lib/admin/audit-format";

describe("admin navigation and sidebar", () => {
  it("includes all essential admin sections and roster import link", () => {
    const labels = adminNavItems.map((item) => item.label);
    expect(labels).toContain("Overview");
    expect(labels).toContain("Academics");
    expect(labels).toContain("Companies");
    expect(labels).toContain("Listings");
    expect(labels).toContain("Roster import");
    expect(labels).toContain("People");
    expect(labels).toContain("Audit log");
    expect(labels).toContain("Settings");
  });

  it("links Roster import to /coordinator/roster with valid icon", () => {
    const rosterItem = adminNavItems.find((item) => item.label === "Roster import");
    expect(rosterItem).toBeDefined();
    expect(rosterItem?.href).toBe("/coordinator/roster");
    expect(rosterItem?.Icon).toBeDefined();
  });

  it("ensures all nav items have valid labels, hrefs, and icons", () => {
    for (const item of adminNavItems) {
      expect(item.label.trim().length).toBeGreaterThan(0);
      expect(item.href.startsWith("/")).toBe(true);
      expect(typeof item.Icon).toBe("object");
    }
  });

  it("formats audit table labels for all admin tables including listings and school_settings", () => {
    expect(tableLabel("listings")).toBe("Listing");
    expect(tableLabel("school_settings")).toBe("School settings");
    expect(tableLabel("departments")).toBe("Department");
    expect(tableLabel("courses")).toBe("Course");
  });
});
