import type { Metadata } from "next";
import { RolePlaceholder } from "@/components/auth/role-placeholder";
import { requireRole } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Student home · Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function StudentHomePage() {
  await requireRole(["student"]);
  return <RolePlaceholder title="Student home" />;
}
