import { AppSidebar } from "@/components/layout/app-sidebar";
import { BottomTabs } from "@/components/layout/bottom-tabs";
import { ShellTopBar } from "@/components/layout/shell-top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getClerkIdentity } from "@/lib/auth/clerk";
import type { Role } from "@/lib/auth/roles";
import { linksFor, roleLabels } from "@/lib/nav";

// The frame around every signed-in page: sidebar, top bar, and (for students,
// who are on phones first) a bottom tab bar. It only shows links; hiding a link
// never protects a page. Each layout still calls requireRole, and every action
// checks the role again.
export async function AppShell({
  role,
  children,
}: Readonly<{ role: Role; children: React.ReactNode }>) {
  const identity = await getClerkIdentity();
  const account = {
    name: identity?.fullName ?? identity?.email ?? "Signed in",
    email: identity?.fullName ? (identity.email ?? null) : null,
  };
  const links = linksFor(role);
  const hasTabs = role === "student";

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar roleLabel={roleLabels[role]} links={links} account={account} />
        <SidebarInset className="bg-page-wash">
          <ShellTopBar links={links} />
          <main
            id="main"
            className={
              hasTabs
                ? "mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 p-4 pb-28 md:p-8 md:pb-8"
                : "mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-6 p-4 md:p-8"
            }
          >
            {children}
          </main>
          {hasTabs ? <BottomTabs label="Student" tabs={links} /> : null}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
