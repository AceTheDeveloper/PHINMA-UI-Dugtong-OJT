"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ClipboardList,
  FileCheck2,
  FileText,
  History,
  LayoutDashboard,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { mockCoordinator } from "@/lib/mock/coordinator";

type NavItem = {
  label: string;
  Icon: LucideIcon;
  // A built screen has a link; the rest show as "Not built".
  href?: string;
};

const navItems: NavItem[] = [
  { label: "Dashboard", Icon: LayoutDashboard, href: "/coordinator" },
  { label: "Students", Icon: Users },
  { label: "Companies", Icon: Building2 },
  { label: "Daily logs", Icon: ClipboardList },
  { label: "Evaluations", Icon: FileCheck2 },
  { label: "Reports", Icon: FileText },
  { label: "Roster import", Icon: Upload, href: "/coordinator/roster" },
  { label: "Audit log", Icon: History },
];

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={
                <Link href="/coordinator" aria-label="Dugtong OJT dashboard" />
              }
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
          <SidebarGroupLabel>Coordinator</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(({ label, Icon, href }) => (
                <SidebarMenuItem key={label}>
                  {href ? (
                    <SidebarMenuButton
                      isActive={pathname === href}
                      tooltip={label}
                      render={
                        <Link
                          href={href}
                          aria-current={pathname === href ? "page" : undefined}
                        />
                      }
                    >
                      <Icon aria-hidden="true" />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  ) : (
                    <>
                      <SidebarMenuButton
                        tooltip={`${label} (not built yet)`}
                        disabled
                        aria-disabled="true"
                        className="disabled:opacity-60"
                      >
                        <Icon aria-hidden="true" />
                        <span>{label}</span>
                      </SidebarMenuButton>
                      <SidebarMenuBadge className="text-faint">
                        Not built
                      </SidebarMenuBadge>
                    </>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="cursor-default">
              <Avatar>
                <AvatarFallback>CS</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {mockCoordinator.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {mockCoordinator.role}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
