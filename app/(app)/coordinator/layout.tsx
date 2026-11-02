import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { requireRole } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Coordinator dashboard | Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function CoordinatorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireRole(["coordinator", "admin"]);
  return <AppShell role="coordinator">{children}</AppShell>;
}
