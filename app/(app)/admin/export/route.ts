import { authorize } from "@/lib/auth/server";
import { adminStudentCsv, adminStudentCsvName } from "@/lib/admin/export";
import { getAdminStudentsList } from "@/lib/admin/student-queries";

// The student progress CSV for all courses across the entire system. Behind sign-in
// like every other file, for a Platform Admin only. Any refusal answers "not found"
// (401 when signed out).

export async function GET() {
  const session = await authorize(["admin"]);
  if (!session.ok) {
    return new Response("Not found", { status: session.error.code === "unauthenticated" ? 401 : 404 });
  }

  const list = await getAdminStudentsList();
  if (!list.ok) return new Response("Something went wrong", { status: 500 });
  if (!list.data) return new Response("Not found", { status: 404 });

  return new Response(adminStudentCsv(list.data.students, list.data.companies), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${adminStudentCsvName()}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
