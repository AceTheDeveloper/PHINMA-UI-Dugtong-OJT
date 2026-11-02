import { z } from "zod";

// Input to the student application actions. Ids come from the browser, so they
// are checked here; the database checks who owns what.

export const applySchema = z.object({
  listingId: z.string().uuid("Choose a listing."),
});

export const withdrawSchema = z.object({
  applicationId: z.string().uuid("Choose an application."),
});

export const maxSearchLength = 100;

// The listings search box. Anything else (an array, too long) becomes no search.
export function cleanSearch(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, maxSearchLength) : "";
}
