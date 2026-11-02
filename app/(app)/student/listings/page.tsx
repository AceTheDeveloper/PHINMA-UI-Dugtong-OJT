import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { EmptyState, LoadError, PageHeader } from "@/components/admin/admin-parts";
import { ListingList } from "@/components/student/listing-list";
import { focusStyle } from "@/components/brand-link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getListingsForStudent, getStudentSummary } from "@/lib/applications/queries";
import { cleanSearch, maxSearchLength } from "@/lib/applications/schemas";
import { requireRole } from "@/lib/auth/server";
import { cn } from "@/lib/utils";

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
      <form action="/student/listings" role="search" className="flex flex-wrap gap-2">
        <label htmlFor="listing-search" className="sr-only">
          Search by company or title
        </label>
        <Input
          id="listing-search"
          name="q"
          type="search"
          defaultValue={search}
          maxLength={maxSearchLength}
          placeholder="Search by company or title"
          className="h-10 w-full max-w-sm"
        />
        <Button type="submit" variant="outline" className="h-10 gap-2">
          <Search aria-hidden="true" className="size-4" />
          Search
        </Button>
        {search ? (
          <Link
            href="/student/listings"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "h-10",
              focusStyle,
            )}
          >
            Clear search
          </Link>
        ) : null}
      </form>

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
