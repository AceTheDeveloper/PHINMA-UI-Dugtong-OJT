import { RoleHeader } from "@/components/layout/role-header";
import type { NavLink } from "@/lib/nav";

const links: readonly NavLink[] = [
  { href: "/supervisor", label: "Home", exact: true },
  { href: "/supervisor/listings", label: "Listings", exact: false },
  { href: "/supervisor/applicants", label: "Applicants", exact: false },
];

export function SupervisorHeader() {
  return <RoleHeader label="Supervisor" links={links} />;
}
