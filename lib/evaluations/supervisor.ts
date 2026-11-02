import "server-only";
import { z } from "zod";
import { adminClient } from "@/lib/db/admin";
import type {
  EvaluationDetail,
  EvaluationQueueRow,
  SubmittedEvaluation,
} from "@/lib/evaluations/supervisor-types";
import { errorFromDatabase, fail, ok, type Result } from "@/lib/result";

// Reads for the supervisor's evaluation screens. They use the service role, so
// every caller has already run requireRole(["supervisor"]) and passes the
// company from the session, never one from the browser.

const unexpected = "Something went wrong. Try again in a moment.";
const db = () => adminClient();
const deploymentStatus = z.enum(["active", "completed", "ended"]);

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

const hoursRow = z.object({ deployment_id: z.string(), approved_hours: z.coerce.number() });

const deploymentRow = z.object({
  id: z.string(),
  status: deploymentStatus,
  student: one(
    z.object({ full_name: z.string(), student_number: z.string(), course_id: z.string() }),
  ),
  batch: one(z.object({ required_hours: z.coerce.number() })),
});

const deploymentSelect =
  "id, status, student:students(full_name, student_number, course_id), batch:ojt_batches(required_hours)";

// Students of this company with their hours and evaluation state, the ones
// ready for evaluation first.
export async function getEvaluationQueue(
  companyId: string,
): Promise<Result<EvaluationQueueRow[]>> {
  const deployments = await read(z.array(deploymentRow), () =>
    db().from("deployments").select(deploymentSelect).eq("company_id", companyId).limit(1000),
  );
  if (!deployments.ok) return deployments;

  const hours = await read(z.array(hoursRow), () =>
    db()
      .from("deployment_hours")
      .select("deployment_id, approved_hours")
      .eq("company_id", companyId)
      .limit(1000),
  );
  if (!hours.ok) return hours;

  const evaluations = await read(
    z.array(z.object({ deployment_id: z.string(), submitted_at: z.string() })),
    () =>
      db()
        .from("evaluations")
        .select("deployment_id, submitted_at, deployment:deployments!inner(company_id)")
        .eq("deployments.company_id", companyId)
        .limit(1000),
  );
  if (!evaluations.ok) return evaluations;

  const pending = await read(z.array(z.object({ deployment_id: z.string() })), () =>
    db()
      .from("daily_logs")
      .select("deployment_id, deployment:deployments!inner(company_id)")
      .eq("deployments.company_id", companyId)
      .eq("status", "pending")
      .limit(5000),
  );
  if (!pending.ok) return pending;

  const hoursOf = new Map(hours.data.map((row) => [row.deployment_id, row.approved_hours]));
  const evaluatedAt = new Map(evaluations.data.map((row) => [row.deployment_id, row.submitted_at]));
  const pendingOf = new Map<string, number>();
  for (const row of pending.data) {
    pendingOf.set(row.deployment_id, (pendingOf.get(row.deployment_id) ?? 0) + 1);
  }

  const rows = deployments.data.map((row): EvaluationQueueRow => {
    const approvedHours = hoursOf.get(row.id) ?? 0;
    const requiredHours = row.batch.required_hours;
    const submittedAt = evaluatedAt.get(row.id) ?? null;
    return {
      deploymentId: row.id,
      studentName: row.student.full_name,
      studentNumber: row.student.student_number,
      status: row.status,
      approvedHours,
      requiredHours,
      pendingEntries: pendingOf.get(row.id) ?? 0,
      evaluatedAt: submittedAt,
      ready: row.status === "active" && submittedAt === null && approvedHours >= requiredHours,
    };
  });
  // Ready first, then the rest by how close they are to the hours.
  rows.sort(
    (a, b) =>
      Number(b.ready) - Number(a.ready) ||
      b.approvedHours / Math.max(b.requiredHours, 1) - a.approvedHours / Math.max(a.requiredHours, 1) ||
      a.studentName.localeCompare(b.studentName),
  );
  return ok(rows);
}

const submittedRow = z.object({
  submitted_at: z.string(),
  overall_comment: z.string().nullable(),
  approved_hours: z.coerce.number(),
  required_hours: z.coerce.number(),
  form: one(z.object({ version: z.number() })),
  scores: z.array(
    z.object({
      score: z.number(),
      comment: z.string().nullable(),
      criterion: one(z.object({ label: z.string(), position: z.number() })),
    }),
  ),
});

function toSubmitted(row: z.infer<typeof submittedRow>): SubmittedEvaluation {
  return {
    submittedAt: row.submitted_at,
    overallComment: row.overall_comment,
    formVersion: row.form.version,
    approvedHours: row.approved_hours,
    requiredHours: row.required_hours,
    scores: [...row.scores]
      .sort((a, b) => a.criterion.position - b.criterion.position)
      .map((item) => ({ label: item.criterion.label, score: item.score, comment: item.comment })),
  };
}

const formRow = z.object({
  id: z.string(),
  version: z.number(),
  criteria: z.array(z.object({ id: z.string(), position: z.number(), label: z.string() })),
});

// One student of this company: their hours, the submitted evaluation if there
// is one, and otherwise the published form to rate against. A deployment of
// another company is "not found", the same as one that does not exist.
export async function getEvaluationDetail(
  companyId: string,
  deploymentId: string,
): Promise<Result<EvaluationDetail>> {
  if (!z.string().uuid().safeParse(deploymentId).success) {
    return fail("not_found", "This student was not found.");
  }
  const found = await read(z.array(deploymentRow), () =>
    db()
      .from("deployments")
      .select(deploymentSelect)
      .eq("id", deploymentId)
      .eq("company_id", companyId),
  );
  if (!found.ok) return found;
  const row = found.data[0];
  if (!row) return fail("not_found", "This student was not found.");

  const hours = await read(z.array(hoursRow), () =>
    db()
      .from("deployment_hours")
      .select("deployment_id, approved_hours")
      .eq("deployment_id", deploymentId),
  );
  if (!hours.ok) return hours;

  const pending = await read(z.array(z.object({ id: z.string() })), () =>
    db().from("daily_logs").select("id").eq("deployment_id", deploymentId).eq("status", "pending"),
  );
  if (!pending.ok) return pending;

  const evaluation = await read(z.array(submittedRow), () =>
    db()
      .from("evaluations")
      .select(
        "submitted_at, overall_comment, approved_hours, required_hours, form:evaluation_forms(version), scores:evaluation_scores(score, comment, criterion:evaluation_criteria(label, position))",
      )
      .eq("deployment_id", deploymentId),
  );
  if (!evaluation.ok) return evaluation;

  let form: EvaluationDetail["form"] = null;
  if (evaluation.data.length === 0) {
    const published = await read(z.array(formRow), () =>
      db()
        .from("evaluation_forms")
        .select("id, version, criteria:evaluation_criteria(id, position, label)")
        .eq("course_id", row.student.course_id)
        .eq("status", "published"),
    );
    if (!published.ok) return published;
    const own = published.data[0];
    if (own) {
      form = {
        id: own.id,
        version: own.version,
        criteria: [...own.criteria]
          .sort((a, b) => a.position - b.position)
          .map((item) => ({ id: item.id, label: item.label })),
      };
    }
  }

  return ok({
    deploymentId: row.id,
    studentName: row.student.full_name,
    studentNumber: row.student.student_number,
    status: row.status,
    approvedHours: hours.data[0]?.approved_hours ?? 0,
    requiredHours: row.batch.required_hours,
    pendingEntries: pending.data.length,
    form,
    submitted: evaluation.data[0] ? toSubmitted(evaluation.data[0]) : null,
  });
}
