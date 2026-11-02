import "server-only";
import { z } from "zod";
import { adminClient } from "@/lib/db/admin";
import type { Applicant, SupervisorSummary } from "@/lib/applicants/types";
import { errorFromDatabase, fail, ok, type Result } from "@/lib/result";

// Reads for the supervisor screens. They use the service role, so every caller
// has already run authorize(["supervisor"]) and passes the company from the
// session, never one from the browser.

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

// PostgREST puts .in() lists in the URL, so long lists go in chunks.
function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

const applicantRow = z.object({
  id: z.string(),
  status,
  created_at: z.string(),
  student_id: z.string(),
  student: one(z.object({ full_name: z.string(), student_number: z.string() })),
  listing: one(z.object({ title: z.string() })),
});

// Applications to this company's listings. Applications waiting for a decision
// come first, then the newest.
export async function getApplicantsForCompany(
  companyId: string,
): Promise<Result<Applicant[]>> {
  const rows = await read(z.array(applicantRow), () =>
    db()
      .from("applications")
      .select(
        "id, status, created_at, student_id, student:students(full_name, student_number), listing:listings!inner(title, company_id)",
      )
      .eq("listings.company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1000),
  );
  if (!rows.ok) return rows;

  const withResume = new Set<string>();
  for (const group of chunks([...new Set(rows.data.map((row) => row.student_id))], 100)) {
    const resumes = await read(z.array(z.object({ student_id: z.string() })), () =>
      db().from("resumes").select("student_id").in("student_id", group),
    );
    if (!resumes.ok) return resumes;
    for (const resume of resumes.data) withResume.add(resume.student_id);
  }

  const applicants = rows.data.map((row) => ({
    id: row.id,
    status: row.status,
    appliedAt: row.created_at,
    studentId: row.student_id,
    studentName: row.student.full_name,
    studentNumber: row.student.student_number,
    listingTitle: row.listing.title,
    hasResume: withResume.has(row.student_id),
  }));
  // Stable sort: waiting first, newest-first order kept inside each group.
  return ok([
    ...applicants.filter((applicant) => applicant.status === "applied"),
    ...applicants.filter((applicant) => applicant.status !== "applied"),
  ]);
}

export async function getSupervisorSummary(
  companyId: string,
): Promise<Result<SupervisorSummary>> {
  const listings = await read(z.array(z.object({ status: z.enum(["open", "closed"]) })), () =>
    db().from("listings").select("status").eq("company_id", companyId),
  );
  if (!listings.ok) return listings;
  const applicants = await getApplicantsForCompany(companyId);
  if (!applicants.ok) return applicants;
  const deployments = await read(z.array(z.object({ id: z.string() })), () =>
    db().from("deployments").select("id").eq("company_id", companyId).eq("status", "active"),
  );
  if (!deployments.ok) return deployments;
  return ok({
    openListings: listings.data.filter((listing) => listing.status === "open").length,
    waitingApplicants: applicants.data.filter((applicant) => applicant.status === "applied").length,
    activeStudents: deployments.data.length,
  });
}
