import { BottomTabs, type Tab } from "@/components/layout/bottom-tabs";
import { RoleHeader } from "@/components/layout/role-header";

const tabs: readonly Tab[] = [
  { href: "/student", label: "Home", exact: true, icon: "home" },
  { href: "/student/listings", label: "Listings", exact: false, icon: "listings" },
  { href: "/student/applications", label: "Applied", exact: false, icon: "applications" },
  { href: "/student/resume", label: "Resume", exact: false, icon: "resume" },
];

const links = tabs.map(({ href, label, exact }) => ({
  href,
  label: href === "/student/applications" ? "Applications" : label,
  exact,
}));

// Students are on phones first: the links live in the bottom tab bar there, and
// in the top bar from small tablets up.
export function StudentHeader() {
  return <RoleHeader label="Student" links={links} navOnPhones={false} />;
}

export function StudentTabs() {
  return <BottomTabs label="Student" tabs={tabs} />;
}
