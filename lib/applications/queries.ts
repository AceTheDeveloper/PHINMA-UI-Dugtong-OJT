import "server-only";
import { z } from "zod";
import { adminClient } from "@/lib/db/admin";
import type {
  StudentApplication,
  StudentListing,
  StudentSummary,
} from "@/lib/applications/types";
import { errorFromDatabase, fail, ok, type Result } from "@/lib/result";

// Reads for the student screens. They use the service role, so every caller has
// already run authorize(["student"]) and passes the student and course from the
// session, never from the browser.

const unexpected = "Something went wrong. Try again in a moment.";
const db = () => adminClient();
const status = z.enum(["applied", "accepted", "rejected", "withdrawn"]);

async function read<S extends z.ZodType>(
  schema: S,
  run: () => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<Result<z.infer<S>>> {
  const { data, error } = await run();
  if (error) return { ok: false, error: errorFromDatabase(error.message) };
  const parsed = schema.safeParse(data);
  return parsed.success ? ok(parsed.data) : fail("unexpected", unexpected);
}

// PostgREST returns a to-one embed as an object; accept a one-item array too.
function one<T extends z.ZodType>(schema: T) {
  return z.union([schema, z.array(schema).length(1).transform((items) => items[0])]);
}

const listingRow = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  created_at: z.string(),
  company: one(z.object({ name: z.string() })),
});
const appliedRow = z.object({ listing_id: z.string(), status });

// Open listings of active companies that are open to the student's course. A
// search matches the company name or the title.
export async function getListingsForStudent(
  studentId: string,
  courseId: string,
  search: string,
): Promise<Result<StudentListing[]>> {
  const listings = await read(z.array(listingRow), () =>
    db()
      .from("listings")
      .select(
        "id, title, description, created_at, company:companies!inner(name), listing_courses!inner(course_id)",
      )
      .eq("status", "open")
      .eq("companies.status", "active")
      .eq("listing_courses.course_id", courseId)
      .order("created_at", { ascending: false })
      .limit(500),
  );
  if (!listings.ok) return listings;

  const applied = await read(z.array(appliedRow), () =>
    db().from("applications").select("listing_id, status").eq("student_id", studentId),
  );
  if (!applied.ok) return applied;
  const byListing = new Map(applied.data.map((row) => [row.listing_id, row.status]));

  const needle = search.toLowerCase();
  return ok(
    listings.data
      .filter(
        (row) =>
          needle === "" ||
          row.title.toLowerCase().includes(needle) ||
          row.company.name.toLowerCase().includes(needle),
      )
      .map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        companyName: row.company.name,
        postedAt: row.created_at,
        applicationStatus: byListing.get(row.id) ?? null,
      })),
  );
}

const applicationRow = z.object({
  id: z.string(),
  status,
  created_at: z.string(),
  listing: one(z.object({ title: z.string(), company: one(z.object({ name: z.string() })) })),
});

export async function getApplicationsForStudent(
  studentId: string,
): Promise<Result<StudentApplication[]>> {
  const rows = await read(z.array(applicationRow), () =>
    db()
      .from("applications")
      .select("id, status, created_at, listing:listings(title, company:companies(name))")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
  );
  if (!rows.ok) return rows;
  return ok(
    rows.data.map((row) => ({
      id: row.id,
      status: row.status,
      listingTitle: row.listing.title,
      companyName: row.listing.company.name,
      appliedAt: row.created_at,
    })),
  );
}

export async function getStudentSummary(studentId: string): Promise<Result<StudentSummary>> {
  const resume = await read(z.array(z.object({ student_id: z.string() })), () =>
    db().from("resumes").select("student_id").eq("student_id", studentId),
  );
  if (!resume.ok) return resume;
  const applications = await read(z.array(z.object({ status })), () =>
    db().from("applications").select("status").eq("student_id", studentId),
  );
  if (!applications.ok) return applications;
  return ok({
    hasResume: resume.data.length > 0,
    openApplications: applications.data.filter((row) => row.status === "applied").length,
    totalApplications: applications.data.length,
  });
}
