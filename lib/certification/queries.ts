import "server-only";
import { z } from "zod";
import { adminClient } from "@/lib/db/admin";
import type {
  CertificateData,
  CertificateTemplate,
  CertificationAccess,
  CertificationSummary,
} from "@/lib/certification/types";
import { errorFromDatabase, fail, ok, type Result } from "@/lib/result";

// Reads for certifications. They use the service role, so every caller has
// already run authorize() and applies the access rule from
// lib/certification/access.ts or passes ids from the session, never from the
// browser.

const unexpected = "Something went wrong. Try again in a moment.";
const db = () => adminClient();

async function read<S extends z.ZodType>(
  schema: S,
  run: () => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<Result<z.infer<S>>> {
  const { data, error } = await run();
  if (error) return { ok: false, error: errorFromDatabase(error.message) };
  const parsed = schema.safeParse(data);
  return parsed.success ? ok(parsed.data) : fail("unexpected", unexpected);
}

const summaryRow = z.object({
  id: z.string(),
  status: z.enum(["issued", "voided"]),
  student_name: z.string(),
  student_number: z.string(),
  course_name: z.string(),
  company_name: z.string(),
  approved_hours: z.coerce.number(),
  start_date: z.string(),
  end_date: z.string(),
  issued_at: z.string(),
});

const summarySelect =
  "id, status, student_name, student_number, course_name, company_name, approved_hours, start_date, end_date, issued_at";

function toSummary(row: z.infer<typeof summaryRow>): CertificationSummary {
  return {
    id: row.id,
    status: row.status,
    studentName: row.student_name,
    studentNumber: row.student_number,
    courseName: row.course_name,
    companyName: row.company_name,
    approvedHours: row.approved_hours,
    startDate: row.start_date,
    endDate: row.end_date,
    issuedAt: row.issued_at,
  };
}

// The student's own issued certification, if the evaluation has been submitted.
export async function getStudentCertification(
  studentId: string,
): Promise<Result<CertificationSummary | null>> {
  const rows = await read(z.array(summaryRow), () =>
    db()
      .from("certifications")
      .select(summarySelect)
      .eq("student_id", studentId)
      .eq("status", "issued")
      .order("issued_at", { ascending: false })
      .limit(1),
  );
  if (!rows.ok) return rows;
  return ok(rows.data[0] ? toSummary(rows.data[0]) : null);
}

// Certifications of these courses, newest first. Issued ones and voided ones, so
// the coordinator can see what happened to a reopened evaluation.
export async function getCertificationsForCourses(
  courseIds: readonly string[],
): Promise<Result<CertificationSummary[]>> {
  if (courseIds.length === 0) return ok([]);
  const rows = await read(z.array(summaryRow), () =>
    db()
      .from("certifications")
      .select(summarySelect)
      .in("course_id", [...courseIds])
      .order("issued_at", { ascending: false })
      .limit(500),
  );
  if (!rows.ok) return rows;
  return ok(rows.data.map(toSummary));
}

const fullRow = summaryRow.extend({
  student_id: z.string(),
  course_id: z.string(),
  supervisor_name: z.string(),
  issuer_name: z.string(),
  required_hours: z.coerce.number(),
  heading: z.string(),
  body: z.string(),
  signatory_1_name: z.string(),
  signatory_1_title: z.string(),
  signatory_2_name: z.string(),
  signatory_2_title: z.string(),
});

// One certification with everything the PDF needs, and what the route needs to
// decide who may have it. Null when it does not exist.
export async function getCertificationForPdf(
  id: string,
): Promise<Result<{ data: CertificateData; access: CertificationAccess } | null>> {
  if (!z.string().uuid().safeParse(id).success) return ok(null);
  const rows = await read(z.array(fullRow), () =>
    db()
      .from("certifications")
      .select(
        `${summarySelect}, student_id, course_id, supervisor_name, issuer_name, required_hours, heading, body, signatory_1_name, signatory_1_title, signatory_2_name, signatory_2_title`,
      )
      .eq("id", id),
  );
  if (!rows.ok) return rows;
  const row = rows.data[0];
  if (!row) return ok(null);
  return ok({
    access: { status: row.status, studentId: row.student_id, courseId: row.course_id },
    data: {
      id: row.id,
      studentName: row.student_name,
      studentNumber: row.student_number,
      courseName: row.course_name,
      companyName: row.company_name,
      supervisorName: row.supervisor_name,
      issuerName: row.issuer_name,
      approvedHours: row.approved_hours,
      requiredHours: row.required_hours,
      startDate: row.start_date,
      endDate: row.end_date,
      issuedAt: row.issued_at,
      heading: row.heading,
      body: row.body,
      signatories: [
        { name: row.signatory_1_name, title: row.signatory_1_title },
        { name: row.signatory_2_name, title: row.signatory_2_title },
      ],
    },
  });
}

const templateRow = z.object({
  course_id: z.string(),
  signatory_1_name: z.string(),
  signatory_1_title: z.string(),
  signatory_2_name: z.string(),
  signatory_2_title: z.string(),
});
const courseRow = z.object({ id: z.string(), code: z.string(), name: z.string() });

// The signatories of each of these courses.
export async function getTemplatesForCourses(
  courseIds: readonly string[],
): Promise<Result<CertificateTemplate[]>> {
  if (courseIds.length === 0) return ok([]);
  const courses = await read(z.array(courseRow), () =>
    db().from("courses").select("id, code, name").in("id", [...courseIds]).order("code"),
  );
  if (!courses.ok) return courses;
  const templates = await read(z.array(templateRow), () =>
    db()
      .from("certificate_templates")
      .select("course_id, signatory_1_name, signatory_1_title, signatory_2_name, signatory_2_title")
      .in("course_id", [...courseIds]),
  );
  if (!templates.ok) return templates;
  const byCourse = new Map(templates.data.map((row) => [row.course_id, row]));
  const found: CertificateTemplate[] = [];
  for (const course of courses.data) {
    const row = byCourse.get(course.id);
    if (!row) continue;
    found.push({
      courseId: course.id,
      courseLabel: `${course.code}, ${course.name}`,
      signatories: [
        { name: row.signatory_1_name, title: row.signatory_1_title },
        { name: row.signatory_2_name, title: row.signatory_2_title },
      ],
    });
  }
  return ok(found);
}
