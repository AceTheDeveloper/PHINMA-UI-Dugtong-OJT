import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/server";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AppSidebar } from "@/components/coordinator/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import ThemeToggle from "@/app/components/theme-toggle";

export const metadata: Metadata = {
  title: "Coordinator dashboard | Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function CoordinatorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireRole(["coordinator", "admin"]);
  return (
    <TooltipProvider>
      <SidebarProvider>
        {session.role === "admin" ? <AdminSidebar /> : <AppSidebar />}
        <SidebarInset className="bg-page-wash">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
            <SidebarTrigger className="-ml-1" aria-label="Toggle navigation" />
            <Separator
              orientation="vertical"
              className="mr-2 data-vertical:h-4 data-vertical:self-auto"
            />
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </header>
          <main id="main" className="flex flex-1 flex-col gap-6 p-4 md:p-6">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
