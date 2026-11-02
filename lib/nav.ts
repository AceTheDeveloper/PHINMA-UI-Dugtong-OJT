import type { Role } from "@/lib/auth/roles";

export type NavLink = { href: string; label: string; exact: boolean };

// Whether a navigation link is the page the person is on. A link that is not
// "exact" also matches the pages below it (/student/listings/abc is Listings).
export function isCurrentLink(pathname: string, link: NavLink): boolean {
  if (link.exact) return pathname === link.href;
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}

// Icons are named, not passed: a server component cannot hand a component
// (a function) to a client one. The client side maps each name to an icon.
export type IconName =
  | "home"
  | "listings"
  | "applications"
  | "resume"
  | "applicants"
  | "dashboard"
  | "students"
  | "companies"
  | "logs"
  | "evaluations"
  | "reports"
  | "import"
  | "audit"
  | "academics"
  | "people"
  | "settings";

// One entry in a role's navigation. A link with no href has no screen yet; the
// sidebar shows it as a disabled row so people can see what is coming.
export type ShellLink = {
  label: string;
  icon: IconName;
  href: string | null;
  exact: boolean;
};

const link = (label: string, icon: IconName, href: string | null, exact = false): ShellLink => ({
  label,
  icon,
  href,
  exact,
});

export const roleLabels: Record<Role, string> = {
  admin: "Platform admin",
  coordinator: "Coordinator",
  supervisor: "Supervisor",
  student: "Student",
};

const links: Record<Role, readonly ShellLink[]> = {
  student: [
    link("Home", "home", "/student", true),
    link("Daily log", "logs", "/student/logs"),
    link("Listings", "listings", "/student/listings"),
    link("Applications", "applications", "/student/applications"),
    link("Resume", "resume", "/student/resume"),
  ],
  supervisor: [
    link("Home", "home", "/supervisor", true),
    link("Listings", "listings", "/supervisor/listings"),
    link("Daily approval", "logs", "/supervisor/approvals"),
    link("Applicants", "applicants", "/supervisor/applicants"),
    link("Students", "students", "/supervisor/students"),
    link("Evaluations", "evaluations", "/supervisor/evaluations"),
  ],
  coordinator: [
    link("Dashboard", "dashboard", "/coordinator", true),
    link("Students", "students", null),
    link("Companies", "companies", null),
    link("Daily logs", "logs", null),
    link("Evaluations", "evaluations", "/coordinator/evaluations"),
    link("Certifications", "reports", "/coordinator/certifications"),
    link("Reports", "reports", null),
    link("Roster import", "import", "/coordinator/roster"),
    link("Audit log", "audit", null),
  ],
  admin: [
    link("Overview", "dashboard", "/admin", true),
    link("Academics", "academics", "/admin/academics"),
    link("Companies", "companies", "/admin/companies"),
    link("Listings", "listings", "/admin/listings"),
    link("Roster import", "import", "/admin/roster"),
    link("People", "people", "/admin/people"),
    link("Audit log", "audit", "/admin/audit"),
    link("Settings", "settings", "/admin/settings"),
  ],
};

export function linksFor(role: Role): readonly ShellLink[] {
  return links[role];
}

// The label of the page the person is on, for the top bar.
export function currentLabel(pathname: string, shellLinks: readonly ShellLink[]): string | null {
  const match = shellLinks.find(
    (item) =>
      item.href !== null &&
      isCurrentLink(pathname, { href: item.href, label: item.label, exact: item.exact }),
  );
  return match?.label ?? null;
}

// "Ana Reyes" becomes "AR"; an email or a single word gives one letter.
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length === 1 ? words[0][0] : words[0][0] + words[words.length - 1][0];
  return letters.toUpperCase();
}
