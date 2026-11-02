import { describe, expect, it } from "vitest";
import { punchFor } from "@/lib/layout/punch";
import { bottomBarFor, currentLabel, isCurrentLink, linksFor } from "@/lib/nav";
import type { LogEntry, TodayView } from "@/lib/logs/types";

const entry = (status: LogEntry["status"]): LogEntry => ({
  id: "l1",
  logDate: "2026-11-03",
  timeIn: "2026-11-03T00:02:00Z",
  timeOut: status === "open" ? null : "2026-11-03T09:00:00Z",
  status,
  journal: null,
  rejectReason: null,
  earlyOutReason: null,
  breakMinutes: 0,
  scheduleStart: "08:00",
  scheduleEnd: "17:00",
  companyName: "Acme",
});

const withEntry = (status: LogEntry["status"]): TodayView => ({
  kind: "entry",
  entry: entry(status),
  scheduledEndAt: null,
  scheduledEndLabel: null,
});

describe("punchFor", () => {
  it("offers Time in, to do on the spot, when the student can time in", () => {
    expect(punchFor({ kind: "ready", scheduleLabel: "8:00 AM to 5:00 PM" })).toEqual({ kind: "time_in" });
  });

  it("offers Time out, which goes to the journal form, while an entry is open", () => {
    expect(punchFor(withEntry("open"))).toEqual({
      kind: "time_out",
      timeIn: "2026-11-03T00:02:00Z",
      href: "/student#today",
    });
  });

  it.each([
    ["pending", "Submitted", "/student#today"],
    ["approved", "Approved", "/student#today"],
    ["rejected", "Fix entry", "/student/logs"],
  ] as const)("is a quiet link for a %s entry", (status, label, href) => {
    expect(punchFor(withEntry(status))).toEqual({ kind: "idle", label, href });
  });

  it.each([
    [{ kind: "none" }, "Today"],
    [{ kind: "no_schedule" }, "Today"],
    [{ kind: "off_day" }, "Today"],
    [{ kind: "ended" }, "Today"],
    [{ kind: "too_early", opensAt: "7:30 AM" }, "Opens soon"],
  ] as const)("is a quiet link, never an action, when %j", (view, label) => {
    expect(punchFor(view as TodayView)).toEqual({ kind: "idle", label, href: "/student#today" });
  });

  it("never offers an action it cannot do: only a ready day gives time_in", () => {
    const views: TodayView[] = [
      { kind: "none" },
      { kind: "no_schedule" },
      { kind: "off_day" },
      { kind: "too_early", opensAt: "7:30 AM" },
      { kind: "ended" },
      withEntry("pending"),
      withEntry("approved"),
      withEntry("rejected"),
    ];
    for (const view of views) expect(punchFor(view).kind).not.toBe("time_in");
  });
});

describe("the phone bar", () => {
  it("gives students four tabs around the punch button, with one Apply tab", () => {
    const bar = bottomBarFor("student")!;
    expect(bar.punch).toBe(true);
    expect(bar.more).toBe(false);
    expect(bar.tabs.map((tab) => tab.label)).toEqual(["Home", "Daily log", "Apply", "Resume"]);
  });

  it("gives supervisors their daily work and a More tab", () => {
    const bar = bottomBarFor("supervisor")!;
    expect(bar.punch).toBe(false);
    expect(bar.more).toBe(true);
    expect(bar.tabs.map((tab) => tab.label)).toEqual(["Home", "Approvals", "Students", "Evaluations"]);
  });

  it("gives the coordinator and the admin the menu only", () => {
    expect(bottomBarFor("coordinator")).toBeNull();
    expect(bottomBarFor("admin")).toBeNull();
  });

  it("only links to pages inside the role's own area", () => {
    for (const role of ["student", "supervisor"] as const) {
      for (const tab of bottomBarFor(role)!.tabs) {
        expect(tab.href === `/${role}` || tab.href?.startsWith(`/${role}/`)).toBe(true);
      }
    }
  });

  it("marks Apply as current on Listings and on Applications", () => {
    const apply = bottomBarFor("student")!.tabs[2];
    const link = { href: apply.href!, label: apply.label, exact: apply.exact, also: apply.also };
    expect(isCurrentLink("/student/listings", link)).toBe(true);
    expect(isCurrentLink("/student/listings/abc", link)).toBe(true);
    expect(isCurrentLink("/student/applications", link)).toBe(true);
    expect(isCurrentLink("/student/resume", link)).toBe(false);
    expect(isCurrentLink("/student", link)).toBe(false);
  });

  it("still names a page by its sidebar label, so the menu is unchanged", () => {
    expect(currentLabel("/student/applications", linksFor("student"))).toBe("Applications");
    expect(currentLabel("/student/listings", linksFor("student"))).toBe("Listings");
  });
});
