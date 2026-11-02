import type { Metadata } from "next";
import { EmptyState, LoadError, PageHeader } from "@/components/admin/admin-parts";
import { ListingList } from "@/components/student/listing-list";
import { ListingSearch } from "@/components/student/listing-search";
import { getListingsForStudent, getStudentSummary } from "@/lib/applications/queries";
import { cleanSearch } from "@/lib/applications/schemas";
import { requireRole } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Listings · Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function StudentListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(["student"]);
  const search = cleanSearch((await searchParams).q);
  const courseId = session.courseIds[0];

  const [listings, summary] =
    session.studentId && courseId
      ? await Promise.all([
          getListingsForStudent(session.studentId, courseId, search),
          getStudentSummary(session.studentId),
        ])
      : [null, null];

  return (
    <>
      <PageHeader
        title="Listings"
        description="Open positions at partner companies for your course."
      />
      <ListingSearch initial={search} />

      {!listings || !summary ? (
        <LoadError message="This account has no student record. Contact your coordinator." />
      ) : !listings.ok ? (
        <LoadError message={listings.error.message} />
      ) : !summary.ok ? (
        <LoadError message={summary.error.message} />
      ) : listings.data.length === 0 ? (
        <EmptyState>
          {search
            ? "No listings match your search. Try a different word."
            : "There are no open listings for your course yet. Check back soon."}
        </EmptyState>
      ) : (
        <ListingList listings={listings.data} hasResume={summary.data.hasResume} />
      )}
    </>
  );
}
