import type { Metadata } from "next";
import { RolePlaceholder } from "@/components/auth/role-placeholder";
import { requireRole } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Supervisor home · Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function SupervisorHomePage() {
  await requireRole(["supervisor"]);
  return <RolePlaceholder title="Supervisor home" />;
}
