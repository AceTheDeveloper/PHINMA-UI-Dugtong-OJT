"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { navIcons } from "@/components/layout/nav-icons";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { initials, isCurrentLink, type ShellLink } from "@/lib/nav";

export type Account = { name: string; email: string | null };

// The one sidebar every role uses: the mark, the role's links, and the account
// with its sign out. On phones it opens as a drawer from the top bar.
export function AppSidebar({
  roleLabel,
  links,
  account,
}: {
  roleLabel: string;
  links: readonly ShellLink[];
  account: Account;
}) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const home = links.find((item) => item.href !== null)?.href ?? "/";
  const closeDrawer = () => setOpenMobile(false);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href={home} aria-label="Dugtong OJT home" onClick={closeDrawer} />}
            >
              <Image
                src="/dugtong-mark.png"
                alt=""
                width={32}
                height={32}
                className="size-8 shrink-0 object-contain"
              />
              <span className="font-heading text-lg font-bold tracking-[-0.02em]">Dugtong</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{roleLabel}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {links.map((item) => {
                const Icon = navIcons[item.icon];
                if (item.href === null) {
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        tooltip={`${item.label} (coming soon)`}
                        disabled
                        aria-disabled="true"
                        className="disabled:opacity-60"
                      >
                        <Icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      <SidebarMenuBadge className="text-sidebar-foreground/70">Soon</SidebarMenuBadge>
                    </SidebarMenuItem>
                  );
                }
                const href = item.href;
                const current = isCurrentLink(pathname, {
                  href,
                  label: item.label,
                  exact: item.exact,
                });
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      isActive={current}
                      tooltip={item.label}
                      className="relative pointer-coarse:h-11 data-active:font-semibold data-active:before:absolute data-active:before:inset-y-2 data-active:before:left-0 data-active:before:w-1 data-active:before:rounded-full data-active:before:bg-teal-bright"
                      render={
                        <Link
                          href={href}
                          aria-current={current ? "page" : undefined}
                          onClick={closeDrawer}
                        />
                      }
                    >
                      <Icon aria-hidden="true" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="cursor-default hover:bg-transparent">
              <Avatar>
                <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground">
                  {initials(account.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{account.name}</span>
                {account.email ? (
                  <span className="truncate text-xs text-sidebar-foreground/70">{account.email}</span>
                ) : null}
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SignOutButton redirectUrl="/sign-in">
              <SidebarMenuButton tooltip="Sign out" className="pointer-coarse:h-11">
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
