import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LoadError } from "@/components/admin/admin-parts";
import { CompanyScreen } from "@/components/coordinator/companies-screen";
import { requireRole } from "@/lib/auth/server";
import { getCompanyView } from "@/lib/coordinator/company-queries";

export const metadata: Metadata = {
  title: "Company | Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function CoordinatorCompanyPage({
  params,
}: {
  params: Promise<{ company: string }>;
}) {
  const session = await requireRole(["coordinator"]);
  const { company } = await params;
  const result = await getCompanyView(session.courseIds, company);
  if (!result.ok) return <LoadError message={result.error.message} />;
  if (!result.data) notFound();

  return <CompanyScreen view={result.data} />;
}
