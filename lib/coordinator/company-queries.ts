import "server-only";
import { z } from "zod";
import { adminClient } from "@/lib/db/admin";
import type {
  CompaniesView,
  CompanyRow,
  CompanyView,
} from "@/lib/coordinator/company-types";
import { errorFromDatabase, fail, ok, type Result } from "@/lib/result";

// Reads for the coordinator's Companies screens. They use the service role, so the
// caller has already run requireRole(["coordinator"]) and passes the course ids
// from the session, never ids from the browser. Companies are the school's
// partners, so all of them are listed; the students, hours, and listings are only
// those of the coordinator's course and newest batch.

const unexpected = "Something went wrong. Try again in a moment.";
const db = () => adminClient();
const limit = 1000;
const money = z.coerce.number();

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

const courseRow = z.object({ id: z.string(), code: z.string() });
const batchRow = z.object({ id: z.string(), school_year: z.string(), required_hours: money });
const companyRow = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  status: z.enum(["active", "inactive"]),
});
const membershipRow = z.object({
  company_id: z.string(),
  is_owner: z.boolean(),
  user: one(z.object({ full_name: z.string(), email: z.string(), is_active: z.boolean() })),
});
const listingRow = z.object({
  id: z.string(),
  company_id: z.string(),
  title: z.string(),
  status: z.enum(["open", "closed"]),
  created_at: z.string(),
});
const hoursRow = z.object({
  deployment_id: z.string(),
  student_id: z.string(),
  company_id: z.string(),
  deployment_status: z.enum(["active", "completed", "ended"]),
  approved_hours: money,
});
const studentRow = z.object({ id: z.string(), full_name: z.string(), student_number: z.string() });

type Batch = { courseShort: string; batchLabel: string; batchId: string; requiredHours: number; courseId: string };

// The coordinator's first course and its newest batch; null when either is missing.
async function resolveBatch(courseIds: readonly string[]): Promise<Result<Batch | null>> {
  if (courseIds.length === 0) return ok(null);
  const courses = await read(z.array(courseRow), () =>
    db().from("courses").select("id, code").in("id", [...courseIds]).order("code"),
  );
  if (!courses.ok) return courses;
  const course = courses.data[0];
  if (!course) return ok(null);
  const batches = await read(z.array(batchRow), () =>
    db()
      .from("ojt_batches")
      .select("id, school_year, required_hours")
      .eq("course_id", course.id)
      .order("school_year", { ascending: false })
      .limit(1),
  );
  if (!batches.ok) return batches;
  const batch = batches.data[0];
  if (!batch) return ok(null);
  return ok({
    courseShort: course.code,
    batchLabel: batch.school_year,
    batchId: batch.id,
    requiredHours: batch.required_hours,
    courseId: course.id,
  });
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export async function getCompaniesView(courseIds: readonly string[]): Promise<Result<CompaniesView | null>> {
  const batch = await resolveBatch(courseIds);
  if (!batch.ok || !batch.data) return batch as Result<null>;
  const scope = batch.data;

  const companies = await read(z.array(companyRow), () =>
    db().from("companies").select("id, name, address, status").order("name").limit(limit),
  );
  if (!companies.ok) return companies;
  const memberships = await read(z.array(membershipRow), () =>
    db()
      .from("supervisor_memberships")
      .select("company_id, is_owner, user:users(full_name, email, is_active)")
      .limit(limit),
  );
  if (!memberships.ok) return memberships;
  const listings = await read(z.array(listingRow), () =>
    db()
      .from("listings")
      .select("id, company_id, title, status, created_at, listing_courses!inner(course_id)")
      .eq("status", "open")
      .eq("listing_courses.course_id", scope.courseId)
      .limit(limit),
  );
  if (!listings.ok) return listings;
  const hours = await read(z.array(hoursRow), () =>
    db()
      .from("deployment_hours")
      .select("deployment_id, student_id, company_id, deployment_status, approved_hours")
      .eq("ojt_batch_id", scope.batchId)
      .limit(limit),
  );
  if (!hours.ok) return hours;

  const rows: CompanyRow[] = companies.data.map((company) => {
    const own = memberships.data.filter((row) => row.company_id === company.id);
    const placed = hours.data.filter((row) => row.company_id === company.id);
    return {
      id: company.id,
      name: company.name,
      status: company.status,
      ownerName: own.find((row) => row.is_owner)?.user.full_name ?? null,
      supervisors: own.length,
      openListings: listings.data.filter((row) => row.company_id === company.id).length,
      activeStudents: placed.filter((row) => row.deployment_status === "active").length,
      approvedHours: round2(placed.reduce((sum, row) => sum + row.approved_hours, 0)),
    };
  });

  return ok({
    course: { courseShort: scope.courseShort, batchLabel: scope.batchLabel, requiredHours: scope.requiredHours },
    companies: rows,
  });
}

// One company, with its supervisors, the listings open to the coordinator's
// course, and the course's students placed there. Null when the company does not
// exist (or the id is not an id).
export async function getCompanyView(
  courseIds: readonly string[],
  companyId: string,
): Promise<Result<CompanyView | null>> {
  if (!z.string().uuid().safeParse(companyId).success) return ok(null);
  const batch = await resolveBatch(courseIds);
  if (!batch.ok || !batch.data) return batch as Result<null>;
  const scope = batch.data;

  const companies = await read(z.array(companyRow), () =>
    db().from("companies").select("id, name, address, status").eq("id", companyId).limit(1),
  );
  if (!companies.ok) return companies;
  const company = companies.data[0];
  if (!company) return ok(null);

  const memberships = await read(z.array(membershipRow), () =>
    db()
      .from("supervisor_memberships")
      .select("company_id, is_owner, user:users(full_name, email, is_active)")
      .eq("company_id", company.id)
      .order("is_owner", { ascending: false })
      .limit(limit),
  );
  if (!memberships.ok) return memberships;
  const listings = await read(z.array(listingRow), () =>
    db()
      .from("listings")
      .select("id, company_id, title, status, created_at, listing_courses!inner(course_id)")
      .eq("company_id", company.id)
      .eq("listing_courses.course_id", scope.courseId)
      .order("created_at", { ascending: false })
      .limit(limit),
  );
  if (!listings.ok) return listings;
  const hours = await read(z.array(hoursRow), () =>
    db()
      .from("deployment_hours")
      .select("deployment_id, student_id, company_id, deployment_status, approved_hours")
      .eq("ojt_batch_id", scope.batchId)
      .eq("company_id", company.id)
      .limit(limit),
  );
  if (!hours.ok) return hours;
  const studentIds = [...new Set(hours.data.map((row) => row.student_id))];
  const students =
    studentIds.length === 0
      ? ok([] as z.infer<typeof studentRow>[])
      : await read(z.array(studentRow), () =>
          db()
            .from("students")
            .select("id, full_name, student_number")
            .eq("ojt_batch_id", scope.batchId)
            .in("id", studentIds)
            .limit(limit),
        );
  if (!students.ok) return students;
  const nameOf = new Map(students.data.map((row) => [row.id, row]));

  return ok({
    course: { courseShort: scope.courseShort, batchLabel: scope.batchLabel, requiredHours: scope.requiredHours },
    company: { id: company.id, name: company.name, address: company.address, status: company.status },
    supervisors: memberships.data.map((row) => ({
      name: row.user.full_name,
      email: row.user.email,
      isOwner: row.is_owner,
      isActive: row.user.is_active,
    })),
    listings: listings.data.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      postedAt: row.created_at,
    })),
    students: hours.data
      .filter((row) => nameOf.has(row.student_id))
      .map((row) => ({
        studentId: row.student_id,
        name: nameOf.get(row.student_id)?.full_name ?? "",
        studentNumber: nameOf.get(row.student_id)?.student_number ?? "",
        deploymentId: row.deployment_id,
        status: row.deployment_status,
        approvedHours: row.approved_hours,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  });
}
