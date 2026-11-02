import "server-only";
import { z } from "zod";
import { adminClient } from "@/lib/db/admin";
import { errorFromDatabase, fail, ok, type Result } from "@/lib/result";

const unexpected = "Something went wrong. Try again in a moment.";
const db = () => adminClient();
const money = z.coerce.number();

function one<T extends z.ZodType>(schema: T) {
  return z.union([schema, z.array(schema).length(1).transform((items) => items[0])]);
}

const rawEvaluationRow = z.object({
  id: z.string(),
  deployment_id: z.string(),
  submitted_at: z.string(),
  overall_comment: z.string().nullable(),
  approved_hours: money,
  required_hours: money,
  form: one(z.object({ version: z.number() })),
  evaluator: one(z.object({ full_name: z.string() })),
  deployment: one(
    z.object({
      student: one(z.object({ id: z.string(), full_name: z.string(), student_number: z.string() })),
      company: one(z.object({ id: z.string(), name: z.string() })),
    }),
  ),
  scores: z.array(
    z.object({
      score: z.number(),
      comment: z.string().nullable(),
      criterion: one(z.object({ label: z.string(), position: z.number() })),
    }),
  ),
  certifications: z.array(
    z.object({
      id: z.string(),
      status: z.enum(["issued", "voided"]),
    }),
  ),
});

export type AdminEvaluationItem = {
  id: string;
  deploymentId: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  companyName: string;
  evaluatorName: string;
  submittedAt: string;
  approvedHours: number;
  requiredHours: number;
  formVersion: number;
  overallComment: string | null;
  scores: { label: string; score: number; comment: string | null }[];
  certificationId: string | null;
  certificationStatus: string | null;
};

const selectString =
  "id, deployment_id, submitted_at, overall_comment, approved_hours, required_hours, form:evaluation_forms(version), evaluator:users!submitted_by(full_name), deployment:deployments!inner(student:students(id, full_name, student_number), company:companies(id, name)), scores:evaluation_scores(score, comment, criterion:evaluation_criteria(label, position)), certifications(id, status)";

export async function getAdminEvaluations(): Promise<Result<AdminEvaluationItem[]>> {
  const { data, error } = await db()
    .from("evaluations")
    .select(selectString)
    .order("submitted_at", { ascending: false });

  if (error) return { ok: false, error: errorFromDatabase(error.message) };
  const parsed = z.array(rawEvaluationRow).safeParse(data);
  if (!parsed.success) return fail("unexpected", unexpected);

  const items: AdminEvaluationItem[] = parsed.data.map((row) => {
    const activeCert = row.certifications.find((c) => c.status === "issued");
    return {
      id: row.id,
      deploymentId: row.deployment_id,
      studentId: row.deployment.student.id,
      studentName: row.deployment.student.full_name,
      studentNumber: row.deployment.student.student_number,
      companyName: row.deployment.company.name,
      evaluatorName: row.evaluator.full_name,
      submittedAt: row.submitted_at,
      approvedHours: row.approved_hours,
      requiredHours: row.required_hours,
      formVersion: row.form.version,
      overallComment: row.overall_comment,
      scores: [...row.scores]
        .sort((a, b) => a.criterion.position - b.criterion.position)
        .map((s) => ({ label: s.criterion.label, score: s.score, comment: s.comment })),
      certificationId: activeCert?.id ?? row.certifications[0]?.id ?? null,
      certificationStatus: activeCert?.status ?? row.certifications[0]?.status ?? null,
    };
  });

  return ok(items);
}
