import type { Metadata } from "next";
import { LoadError, PageHeader } from "@/components/admin/admin-parts";
import { HistorySection } from "@/components/admin/history-section";
import { AddListingSheet } from "@/components/admin/listing-forms";
import { ListingsTable } from "@/components/admin/listings-table";
import { getAcademics, getCompanies, getListings } from "@/lib/admin/queries";
import { requireRole } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Listings | Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function AdminListingsPage() {
  await requireRole(["admin"]);
  const [listings, companies, academics] = await Promise.all([
    getListings(),
    getCompanies(),
    getAcademics(),
  ]);

  if (!listings.ok) return <LoadError message={listings.error.message} />;
  if (!companies.ok) return <LoadError message={companies.error.message} />;
  if (!academics.ok) return <LoadError message={academics.error.message} />;

  const activeCompanies = companies.data
    .filter((company) => company.status === "active")
    .map((company) => ({
      value: company.id,
      label: company.name,
    }));

  const courseOptions = academics.data.flatMap((department) =>
    department.courses
      .filter((course) => course.isActive)
      .map((course) => ({
        value: course.id,
        label: `${course.code} · ${department.code}`,
      })),
  );

  return (
    <>
      <PageHeader
        title="Listings"
        description="Browse and manage OJT listings for partner companies across all courses."
        actions={
          <AddListingSheet companies={activeCompanies} courses={courseOptions} />
        }
      />

      <ListingsTable listings={listings.data} courses={courseOptions} />

      <HistorySection
        filter={{ tables: ["listings", "listing_courses"] }}
        description="Changes to listings and their course allocations."
      />
    </>
  );
}
