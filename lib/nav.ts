export type NavLink = { href: string; label: string; exact: boolean };

// Whether a navigation link is the page the person is on. A link that is not
// "exact" also matches the pages below it (/student/listings/abc is Listings).
export function isCurrentLink(pathname: string, link: NavLink): boolean {
  if (link.exact) return pathname === link.href;
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}
