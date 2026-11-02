import "server-only";
import { z } from "zod";
import { adminClient } from "@/lib/db/admin";
import type { DtrAccess, DtrData, DtrEntry } from "@/lib/dtr/types";
import { errorFromDatabase, fail, ok, type Result } from "@/lib/result";

// Reads for the DTR. They use the service role, so every caller applies the access
// rule in lib/dtr/access.ts (or passes ids from the session) before it hands
// anything on.

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

// PostgREST returns a to-one embed as an object; accept a one-item array too.
function one<T extends z.ZodType>(schema: T) {
  return z.union([schema, z.array(schema).length(1).transform((items) => items[0])]);
}

const deploymentRow = z.object({
  id: z.string(),
  company_id: z.string(),
  student: one(
    z.object({
      id: z.string(),
      full_name: z.string(),
      student_number: z.string(),
      course_id: z.string(),
    }),
  ),
});
const entryRow = z.object({
  log_date: z.string(),
  time_in: z.string(),
  time_out: z.string().nullable(),
  break_minutes: z.number(),
  approved_by: z.string().nullable(),
});
const userRow = z.object({ id: z.string(), full_name: z.string() });
const ownerRow = z.object({ user: one(z.object({ full_name: z.string() })) });

// Minutes worked in an entry, the break taken off and never below zero. Exact, not
// rounded, so the total matches the approved hours the rest of the app shows.
export function entryMinutes(timeIn: string, timeOut: string, breakMinutes: number): number {
  return Math.max(0, (Date.parse(timeOut) - Date.parse(timeIn)) / 60000 - breakMinutes);
}

// One deployment's DTR and what the route needs to decide who may have it. Null
// when the deployment does not exist.
export async function getDtr(
  deploymentId: string,
): Promise<Result<{ data: DtrData; access: DtrAccess } | null>> {
  if (!z.string().uuid().safeParse(deploymentId).success) return ok(null);

  const found = await read(z.array(deploymentRow), () =>
    db()
      .from("deployments")
      .select("id, company_id, student:students(id, full_name, student_number, course_id)")
      .eq("id", deploymentId),
  );
  if (!found.ok) return found;
  const deployment = found.data[0];
  if (!deployment) return ok(null);

  const logs = await read(z.array(entryRow), () =>
    db()
      .from("daily_logs")
      .select("log_date, time_in, time_out, break_minutes, approved_by")
      .eq("deployment_id", deploymentId)
      .eq("status", "approved")
      .order("log_date", { ascending: true })
      .limit(1000),
  );
  if (!logs.ok) return logs;

  const entries: DtrEntry[] = [];
  for (const log of logs.data) {
    if (log.time_out === null) continue;
    entries.push({
      date: log.log_date,
      timeIn: log.time_in,
      timeOut: log.time_out,
      minutes: entryMinutes(log.time_in, log.time_out, log.break_minutes),
    });
  }

  // The supervisors who approved the entries; if none has yet, the company's owner.
  const approverIds = [...new Set(logs.data.map((log) => log.approved_by).filter((id): id is string => id !== null))];
  let supervisorName: string | null = null;
  if (approverIds.length > 0) {
    const users = await read(z.array(userRow), () =>
      db().from("users").select("id, full_name").in("id", approverIds),
    );
    if (!users.ok) return users;
    const names = approverIds
      .map((id) => users.data.find((user) => user.id === id)?.full_name)
      .filter((name): name is string => Boolean(name));
    supervisorName = names.length > 0 ? names.join(", ") : null;
  }
  if (supervisorName === null) {
    const owners = await read(z.array(ownerRow), () =>
      db()
        .from("supervisor_memberships")
        .select("user:users(full_name)")
        .eq("company_id", deployment.company_id)
        .order("is_owner", { ascending: false })
        .limit(1),
    );
    if (!owners.ok) return owners;
    supervisorName = owners.data[0]?.user.full_name ?? null;
  }

  return ok({
    access: {
      studentId: deployment.student.id,
      companyId: deployment.company_id,
      courseId: deployment.student.course_id,
    },
    data: {
      studentName: deployment.student.full_name,
      studentNumber: deployment.student.student_number,
      supervisorName,
      entries,
    },
  });
}

const ownDeploymentRow = z.object({
  id: z.string(),
  status: z.enum(["active", "completed", "ended"]),
  company: one(z.object({ name: z.string() })),
});

export type OwnDeployment = {
  id: string;
  status: "active" | "completed" | "ended";
  companyName: string;
};

// The student's own deployments, newest first, for the DTR buttons on their page.
export async function getDeploymentsOfStudent(studentId: string): Promise<Result<OwnDeployment[]>> {
  const rows = await read(z.array(ownDeploymentRow), () =>
    db()
      .from("deployments")
      .select("id, status, company:companies(name)")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
  );
  if (!rows.ok) return rows;
  return ok(rows.data.map((row) => ({ id: row.id, status: row.status, companyName: row.company.name })));
}
