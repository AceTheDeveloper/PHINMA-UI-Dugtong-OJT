import { AppShell } from "@/components/layout/app-shell";
import { requireRole } from "@/lib/auth/server";

export default async function StudentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireRole(["student"]);
  return <AppShell role="student">{children}</AppShell>;
}
