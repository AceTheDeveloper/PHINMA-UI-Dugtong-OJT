import "server-only";
import { z } from "zod";
import type { Session } from "@/lib/auth/session";
import { adminClient } from "@/lib/db/admin";
import { punchFor, type PunchState } from "@/lib/layout/punch";
import { getTodayForStudent } from "@/lib/logs/queries";
import { formatLogDate } from "@/lib/logs/logic";
import { manilaToday } from "@/lib/schedules/logic";

// What the frame around every page shows besides the links: who and what the
// person is working in (the top bar), the student's punch button, and the
// supervisor's count of entries waiting. Small reads, and all of it is optional:
// if any read fails the page still opens, just without that detail. Nothing here
// is a permission; it is only words and numbers.

export type ShellContext = { primary: string; secondary: string | null };

export type ShellData = {
  context: ShellContext | null;
  punch: PunchState | null;
  // Counts to show on a tab, by the tab's link.
  badges: Record<string, number>;
  // Today's date in school time, for the top bar.
  dateLabel: string;
};

const db = () => adminClient();

// PostgREST returns a to-one embed as an object; accept a one-item array too.
function one<T extends z.ZodType>(schema: T) {
  return z.union([schema, z.array(schema).length(1).transform((items) => items[0])]);
}

async function rows<S extends z.ZodType>(
  schema: S,
  run: () => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<z.infer<S> | null> {
  try {
    const { data, error } = await run();
    if (error) return null;
    const parsed = schema.safeParse(data);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function studentContext(studentId: string): Promise<ShellContext | null> {
  const student = await rows(
    z.array(
      z.object({
        course: one(z.object({ code: z.string() })),
        batch: one(z.object({ school_year: z.string() })),
      }),
    ),
    () =>
      db()
        .from("students")
        .select("course:courses(code), batch:ojt_batches(school_year)")
        .eq("id", studentId),
  );
  const own = student?.[0];
  const deployment = await rows(
    z.array(z.object({ company: one(z.object({ name: z.string() })) })),
    () =>
      db()
        .from("deployments")
        .select("company:companies(name)")
        .eq("student_id", studentId)
        .eq("status", "active")
        .limit(1),
  );
  if (!own && !deployment) return null;
  return {
    primary: deployment?.[0]?.company.name ?? "No placement yet",
    secondary: own ? `${own.course.code}, batch ${own.batch.school_year}` : null,
  };
}

async function supervisorContext(companyId: string): Promise<ShellContext | null> {
  const company = await rows(z.array(z.object({ name: z.string() })), () =>
    db().from("companies").select("name").eq("id", companyId),
  );
  return company?.[0] ? { primary: company[0].name, secondary: null } : null;
}

// Entries waiting for this company's supervisors, from the activity view.
async function pendingEntries(companyId: string): Promise<number | null> {
  const found = await rows(z.array(z.object({ pending_entries: z.number() })), () =>
    db().from("deployment_activity").select("pending_entries").eq("company_id", companyId).limit(1000),
  );
  return found ? found.reduce((sum, row) => sum + row.pending_entries, 0) : null;
}

async function coordinatorContext(courseIds: readonly string[]): Promise<ShellContext | null> {
  if (courseIds.length === 0) return null;
  const courses = await rows(z.array(z.object({ id: z.string(), code: z.string() })), () =>
    db().from("courses").select("id, code").in("id", [...courseIds]).order("code").limit(1),
  );
  const course = courses?.[0];
  if (!course) return null;
  const batch = await rows(z.array(z.object({ school_year: z.string() })), () =>
    db()
      .from("ojt_batches")
      .select("school_year")
      .eq("course_id", course.id)
      .order("school_year", { ascending: false })
      .limit(1),
  );
  return { primary: course.code, secondary: batch?.[0] ? `batch ${batch[0].school_year}` : null };
}

async function adminContext(): Promise<ShellContext | null> {
  const school = await rows(z.array(z.object({ name: z.string() })), () =>
    db().from("school_settings").select("name"),
  );
  return school?.[0] ? { primary: school[0].name, secondary: null } : null;
}

export async function getShellData(session: Session): Promise<ShellData> {
  const dateLabel = formatLogDate(manilaToday());
  const data: ShellData = { context: null, punch: null, badges: {}, dateLabel };

  switch (session.role) {
    case "student": {
      if (!session.studentId) return data;
      const [context, today] = await Promise.all([
        studentContext(session.studentId),
        getTodayForStudent(session.studentId).catch(() => null),
      ]);
      data.context = context;
      data.punch = today?.ok ? punchFor(today.data.view) : null;
      return data;
    }
    case "supervisor": {
      if (!session.companyId) return data;
      const [context, pending] = await Promise.all([
        supervisorContext(session.companyId),
        pendingEntries(session.companyId),
      ]);
      data.context = context;
      if (pending) data.badges["/supervisor/approvals"] = pending;
      return data;
    }
    case "coordinator":
      data.context = await coordinatorContext(session.courseIds);
      return data;
    case "admin":
      data.context = await adminContext();
      return data;
    default:
      return data;
  }
}
