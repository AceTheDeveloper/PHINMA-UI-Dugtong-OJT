import { authorize } from "@/lib/auth/server";
import { supervisorCsv, supervisorCsvName } from "@/lib/supervisor/export";
import { getCompanyExport } from "@/lib/supervisor/export-queries";

// The student progress CSV of the supervisor's company. Behind sign-in like every
// other file, for a supervisor only, and read for the company in their session,
// so it can only hold their own company's students. Any refusal answers "not
// found" (401 when signed out). Nothing is stored.

export async function GET() {
  const session = await authorize(["supervisor"]);
  if (!session.ok) {
    return new Response("Not found", { status: session.error.code === "unauthenticated" ? 401 : 404 });
  }
  const { companyId } = session.data;
  if (!companyId) return new Response("Not found", { status: 404 });

  const data = await getCompanyExport(companyId);
  if (!data.ok) return new Response("Something went wrong", { status: 500 });
  if (!data.data) return new Response("Not found", { status: 404 });

  return new Response(supervisorCsv(data.data.rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${supervisorCsvName(data.data.companyName)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
