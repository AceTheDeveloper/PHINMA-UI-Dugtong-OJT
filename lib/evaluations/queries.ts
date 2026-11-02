import "server-only";
import { z } from "zod";
import { adminClient } from "@/lib/db/admin";
import type { CourseForms, EvaluationForm } from "@/lib/evaluations/types";
import { errorFromDatabase, fail, ok, type Result } from "@/lib/result";

// Reads for the coordinator's evaluation form screen. They use the service role,
// so every caller has already run requireRole(["coordinator"]) and passes the
// course ids from the session, never ones from the browser.

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

const courseRow = z.object({ id: z.string(), code: z.string(), name: z.string() });

const formRow = z.object({
  id: z.string(),
  course_id: z.string(),
  version: z.number(),
  status: z.enum(["draft", "published", "archived"]),
  published_at: z.string().nullable(),
  criteria: z.array(z.object({ position: z.number(), label: z.string() })),
});

function toForm(row: z.infer<typeof formRow>): EvaluationForm {
  return {
    id: row.id,
    version: row.version,
    status: row.status === "published" ? "published" : "draft",
    publishedAt: row.published_at,
    criteria: [...row.criteria].sort((a, b) => a.position - b.position).map((item) => item.label),
  };
}

// The published form and the draft of each of these courses.
export async function getFormsForCourses(
  courseIds: readonly string[],
): Promise<Result<CourseForms[]>> {
  if (courseIds.length === 0) return ok([]);
  const courses = await read(z.array(courseRow), () =>
    db().from("courses").select("id, code, name").in("id", [...courseIds]).order("code"),
  );
  if (!courses.ok) return courses;

  const forms = await read(z.array(formRow), () =>
    db()
      .from("evaluation_forms")
      .select("id, course_id, version, status, published_at, criteria:evaluation_criteria(position, label)")
      .in("course_id", [...courseIds])
      .in("status", ["draft", "published"]),
  );
  if (!forms.ok) return forms;

  return ok(
    courses.data.map((course) => {
      const own = forms.data.filter((form) => form.course_id === course.id);
      const published = own.find((form) => form.status === "published");
      const draft = own.find((form) => form.status === "draft");
      return {
        courseId: course.id,
        courseLabel: `${course.code}, ${course.name}`,
        published: published ? toForm(published) : null,
        draft: draft ? toForm(draft) : null,
      };
    }),
  );
}
