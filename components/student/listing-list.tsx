"use client";

import { useState, useTransition } from "react";
import { Building2 } from "lucide-react";
import { applyToListingAction } from "@/app/(app)/student/applications/actions";
import { FormMessage } from "@/components/admin/form-parts";
import { ApplicationStatusBadge, formatDate } from "@/components/student/application-status";
import { Button } from "@/components/ui/button";
import type { StudentListing } from "@/lib/applications/types";

// The listings a student can apply to. The Apply button is a convenience: the
// server checks the course, the resume, and duplicates again.
const unexpected = "Something went wrong. Try again in a moment.";

export function ListingList({
  listings,
  hasResume,
}: {
  listings: StudentListing[];
  hasResume: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [workingOn, setWorkingOn] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function apply(listingId: string) {
    setMessage(null);
    setWorkingOn(listingId);
    startTransition(async () => {
      try {
        const result = await applyToListingAction({ listingId });
        if (!result.ok) setMessage(result.error.message);
      } catch {
        setMessage(unexpected);
      } finally {
        setWorkingOn(null);
      }
    });
  }

  return (
    <div className="grid gap-4">
      <FormMessage message={message} />
      <ul className="grid gap-4 md:grid-cols-2">
        {listings.map((listing) => (
          <li key={listing.id}>
            <article className="grid h-full content-between gap-5 rounded-2xl border border-border bg-card p-5 shadow-panel sm:p-6">
              <div className="grid gap-2">
                <p className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-teal-text">
                    <Building2 aria-hidden="true" className="size-4 shrink-0" />
                    <span className="wrap-break-word">{listing.companyName}</span>
                  </p>
                  <h2 className="font-heading text-xl font-bold leading-snug tracking-[-0.01em] text-ink">
                    {listing.title}
                  </h2>
                  {listing.description ? (
                    <p className="line-clamp-4 whitespace-pre-line text-[15px] leading-[1.6] text-copy-muted">
                      {listing.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground tabular-nums">
                    Posted {formatDate(listing.postedAt)}
                  </p>
                  {listing.applicationStatus ? (
                    <ApplicationStatusBadge status={listing.applicationStatus} />
                  ) : (
                    <div className="grid justify-items-end gap-1">
                      <Button
                        type="button"
                        size="lg"
                        disabled={!hasResume || pending}
                        onClick={() => apply(listing.id)}
                      >
                        {workingOn === listing.id ? "Applying" : "Apply"}
                      </Button>
                      {!hasResume ? (
                        <p className="text-sm text-muted-foreground">
                          Upload your resume to apply.
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
