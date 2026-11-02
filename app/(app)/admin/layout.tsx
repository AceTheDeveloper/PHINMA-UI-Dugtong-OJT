import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { requireRole } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Admin | Dugtong OJT",
  robots: { index: false, follow: false },
};

// Every page under /admin sits behind this check. Each server action checks
// the Admin role again, because a layout alone never protects an action.
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireRole(["admin"]);
  return <AppShell role="admin">{children}</AppShell>;
}
