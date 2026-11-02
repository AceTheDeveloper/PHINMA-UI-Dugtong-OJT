import { authorize } from "@/lib/auth/server";
import { studentCsv, studentCsvName } from "@/lib/coordinator/export";
import { getDashboard } from "@/lib/coordinator/queries";

// The student progress CSV of the coordinator's course. Behind sign-in like every
// other file, for a coordinator only, and built from the same rows as the
// dashboard, so it can only hold the coordinator's own students. Any refusal
// answers "not found" (401 when signed out).

export async function GET() {
  const session = await authorize(["coordinator"]);
  if (!session.ok) {
    return new Response("Not found", { status: session.error.code === "unauthenticated" ? 401 : 404 });
  }

  const dashboard = await getDashboard(session.data.courseIds);
  if (!dashboard.ok) return new Response("Something went wrong", { status: 500 });
  if (!dashboard.data) return new Response("Not found", { status: 404 });

  return new Response(studentCsv(dashboard.data), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${studentCsvName(dashboard.data)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
