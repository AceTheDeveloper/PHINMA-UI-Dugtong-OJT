"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import {
  Briefcase,
  Building2,
  GraduationCap,
  History,
  LayoutDashboard,
  LogOut,
  Settings,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

export const adminNavItems: { label: string; href: string; Icon: LucideIcon }[] = [
  { label: "Overview", href: "/admin", Icon: LayoutDashboard },
  { label: "Academics", href: "/admin/academics", Icon: GraduationCap },
  { label: "Companies", href: "/admin/companies", Icon: Building2 },
  { label: "Listings", href: "/admin/listings", Icon: Briefcase },
  { label: "Roster import", href: "/admin/roster", Icon: Upload },
  { label: "People", href: "/admin/people", Icon: Users },
  { label: "Audit log", href: "/admin/audit", Icon: History },
  { label: "Settings", href: "/admin/settings", Icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/admin" aria-label="Dugtong OJT admin overview" />}
            >
              <Image
                src="/dugtong-mark.png"
                alt=""
                width={32}
                height={32}
                className="size-8 shrink-0 object-contain"
              />
              <span className="font-heading text-base font-extrabold tracking-[-0.03em]">
                Dugtong
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminNavItems.map(({ label, href, Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    isActive={isActive(href)}
                    tooltip={label}
                    render={
                      <Link
                        href={href}
                        aria-current={isActive(href) ? "page" : undefined}
                      />
                    }
                  >
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SignOutButton redirectUrl="/sign-in">
              <SidebarMenuButton tooltip="Sign out">
                <LogOut aria-hidden="true" />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SignOutButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
