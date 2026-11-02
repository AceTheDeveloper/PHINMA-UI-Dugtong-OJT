import { RoleHeader, type NavLink } from "@/components/layout/role-header";

const links: readonly NavLink[] = [
  { href: "/student", label: "Home", exact: true },
  { href: "/student/listings", label: "Listings", exact: false },
  { href: "/student/applications", label: "Applications", exact: false },
  { href: "/student/resume", label: "Resume", exact: false },
];

export function StudentHeader() {
  return <RoleHeader label="Student" links={links} />;
}
