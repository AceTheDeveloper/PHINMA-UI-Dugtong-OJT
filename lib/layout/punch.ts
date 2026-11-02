import type { TodayView } from "@/lib/logs/types";

// What the punch button in the phone bar does, from the student's day. It is the
// daily action, one tap from every page: Time in starts the entry right there. Time
// out needs the journal, so it takes the student to the form on the home page. Any
// other moment (no schedule yet, a day off, already submitted) is a quiet link to
// where that is explained. The database re-checks every rule; this only chooses
// what to offer.

export type PunchState =
  | { kind: "time_in" }
  | { kind: "time_out"; timeIn: string; href: string }
  | { kind: "idle"; label: string; href: string };

export const todayHref = "/student#today";

export function punchFor(view: TodayView): PunchState {
  switch (view.kind) {
    case "ready":
      return { kind: "time_in" };
    case "entry": {
      const { status, timeIn } = view.entry;
      if (status === "open") return { kind: "time_out", timeIn, href: todayHref };
      if (status === "rejected") return { kind: "idle", label: "Fix entry", href: "/student/logs" };
      if (status === "approved") return { kind: "idle", label: "Approved", href: todayHref };
      return { kind: "idle", label: "Submitted", href: todayHref };
    }
    case "too_early":
      return { kind: "idle", label: "Opens soon", href: todayHref };
    default:
      return { kind: "idle", label: "Today", href: todayHref };
  }
}
