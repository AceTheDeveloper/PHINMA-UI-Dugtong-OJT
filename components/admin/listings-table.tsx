"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EmptyState, ListingStatusBadge } from "@/components/admin/admin-parts";
import { NativeSelect } from "@/components/admin/form-parts";
import {
  EditListingSheet,
  ListingStatusButton,
} from "@/components/admin/listing-forms";
import { RoleBadge } from "@/components/coordinator/status-badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/admin/format";
import type { AdminListingSummary } from "@/lib/admin/queries";
import type { Option } from "@/components/admin/forms";

export function ListingsTable({
  listings,
  courses,
  hideCompanyColumn = false,
}: {
  listings: AdminListingSummary[];
  courses: Option[];
  hideCompanyColumn?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return listings.filter((listing) => {
      if (statusFilter !== "all" && listing.status !== statusFilter) {
        return false;
      }
      if (q) {
        const matchesTitle = listing.title.toLowerCase().includes(q);
        const matchesCompany = listing.companyName.toLowerCase().includes(q);
        const matchesCourse = listing.courseCodes.some((c) => c.toLowerCase().includes(q));
        if (!matchesTitle && !matchesCompany && !matchesCourse) return false;
      }
      return true;
    });
  }, [listings, search, statusFilter]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-48 flex-1 sm:max-w-xs">
          <Input
            id="listing-search"
            type="search"
            placeholder="Search listings or companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="w-36">
          <NativeSelect
            id="listing-status-filter"
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </NativeSelect>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState>
          {search || statusFilter !== "all"
            ? "No listings match your search or filter."
            : "No listings available yet. Add the first one."}
        </EmptyState>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opportunity</TableHead>
                {!hideCompanyColumn ? <TableHead>Company</TableHead> : null}
                <TableHead>Open to</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((listing) => (
                <TableRow key={listing.id}>
                  <TableCell>
                    <p className="font-semibold text-ink">{listing.title}</p>
                    {listing.description ? (
                      <p className="line-clamp-2 max-w-prose text-xs text-muted-foreground">
                        {listing.description}
                      </p>
                    ) : null}
                  </TableCell>
                  {!hideCompanyColumn ? (
                    <TableCell>
                      <Link
                        href={`/admin/companies/${listing.companyId}`}
                        className="font-medium text-ink hover:text-primary hover:underline"
                      >
                        {listing.companyName}
                      </Link>
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {listing.courseCodes.map((code) => (
                        <RoleBadge key={code} role="info">
                          {code}
                        </RoleBadge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ListingStatusBadge status={listing.status} />
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {formatDateTime(listing.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <EditListingSheet listing={listing} courses={courses} />
                      <ListingStatusButton listingId={listing.id} status={listing.status} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
