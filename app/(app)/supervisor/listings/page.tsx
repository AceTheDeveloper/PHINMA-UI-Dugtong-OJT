import type { Metadata } from "next";
import { LoadError, PageHeader } from "@/components/admin/admin-parts";
import { AddListingSheet } from "@/components/admin/listing-forms";
import { ListingsTable } from "@/components/admin/listings-table";
import { getAcademics, getCompany, getListings } from "@/lib/admin/queries";
import { requireRole } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Listings · Dugtong OJT",
  robots: { index: false, follow: false },
};

// The company's own listings. The admin's listing table and forms are reused,
// with the company fixed to the supervisor's. The server takes the company
// from the session and the database checks it again.
export default async function SupervisorListingsPage() {
  const session = await requireRole(["supervisor"]);
  if (!session.companyId) {
    return <LoadError message="This account has no company. Contact the admin." />;
  }

  const [company, listings, academics] = await Promise.all([
    getCompany(session.companyId),
    getListings({ companyId: session.companyId }),
    getAcademics(),
  ]);
  if (!company.ok) return <LoadError message={company.error.message} />;
  if (!company.data) return <LoadError message="Your company was not found. Contact the admin." />;
  if (!listings.ok) return <LoadError message={listings.error.message} />;
  if (!academics.ok) return <LoadError message={academics.error.message} />;

  const courseOptions = academics.data.flatMap((department) =>
    department.courses
      .filter((course) => course.isActive)
      .map((course) => ({
        value: course.id,
        label: `${course.code} · ${department.code}`,
      })),
  );
  const { company: own } = company.data;
  const companyOption = [{ value: own.id, label: own.name }];

  return (
    <>
      <PageHeader
        title="Listings"
        description={`Open positions at ${own.name}. Students of the chosen courses can apply to open listings.`}
        actions={
          own.status === "active" ? (
            <AddListingSheet
              companies={companyOption}
              courses={courseOptions}
              companyId={own.id}
              companyName={own.name}
            />
          ) : null
        }
      />
      <ListingsTable listings={listings.data} courses={courseOptions} hideCompanyColumn />
    </>
  );
}
