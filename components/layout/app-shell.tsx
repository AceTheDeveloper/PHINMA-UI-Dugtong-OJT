import { AppSidebar } from "@/components/layout/app-sidebar";
import { BottomTabs } from "@/components/layout/bottom-tabs";
import { ShellTopBar } from "@/components/layout/shell-top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getClerkIdentity } from "@/lib/auth/clerk";
import type { Role } from "@/lib/auth/roles";
import type { Session } from "@/lib/auth/session";
import { getShellData } from "@/lib/layout/context";
import { bottomBarFor, linksFor, roleLabels } from "@/lib/nav";

// The frame around every signed-in page: the dark sidebar, a top bar that says
// where the person is working, and on phones a bar along the bottom (the punch
// button for students, the approvals count for supervisors). It only shows links
// and context; hiding a link never protects a page. Each layout still calls
// requireRole, and every action checks the role again.
export async function AppShell({
  role,
  session,
  children,
}: Readonly<{ role: Role; session: Session; children: React.ReactNode }>) {
  const [identity, shell] = await Promise.all([getClerkIdentity(), getShellData(session)]);
  const account = {
    name: identity?.fullName ?? identity?.email ?? "Signed in",
    email: identity?.fullName ? (identity.email ?? null) : null,
  };
  const links = linksFor(role);
  const bar = bottomBarFor(role);

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar roleLabel={roleLabels[role]} links={links} account={account} />
        <SidebarInset className="bg-page-wash">
          <ShellTopBar context={shell.context} dateLabel={shell.dateLabel} />
          <main
            id="main"
            className={
              bar
                ? "mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 p-4 pb-28 md:p-8 md:pb-8"
                : "mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-6 p-4 md:p-8"
            }
          >
            {children}
          </main>
          {bar ? <BottomTabs bar={bar} badges={shell.badges} punch={shell.punch} /> : null}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
