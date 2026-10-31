"use client";

import Image from "next/image";
import Link from "next/link";
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
  built: boolean;
};

const navItems: NavItem[] = [
  { label: "Dashboard", Icon: LayoutDashboard, built: true },
  { label: "Students", Icon: Users, built: false },
  { label: "Companies", Icon: Building2, built: false },
  { label: "Daily logs", Icon: ClipboardList, built: false },
  { label: "Evaluations", Icon: FileCheck2, built: false },
  { label: "Reports", Icon: FileText, built: false },
  { label: "Roster import", Icon: Upload, built: false },
  { label: "Audit log", Icon: History, built: false },
];

export function AppSidebar() {
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
              {navItems.map(({ label, Icon, built }) => (
                <SidebarMenuItem key={label}>
                  {built ? (
                    <SidebarMenuButton
                      isActive
                      tooltip={label}
                      render={<Link href="/coordinator" aria-current="page" />}
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
