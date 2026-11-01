import type { Metadata } from "next";
import { RolePlaceholder } from "@/components/auth/role-placeholder";
import { requireRole } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Admin home · Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function AdminHomePage() {
  await requireRole(["admin"]);
  return <RolePlaceholder title="Admin home" />;
}
