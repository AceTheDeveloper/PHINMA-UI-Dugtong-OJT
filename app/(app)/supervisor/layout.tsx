import { AppShell } from "@/components/layout/app-shell";
import { requireRole } from "@/lib/auth/server";

export default async function SupervisorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireRole(["supervisor"]);
  return <AppShell role="supervisor">{children}</AppShell>;
}
