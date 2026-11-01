import { authorize } from "@/lib/auth/server";
import { rosterColumns } from "@/lib/roster/parse";

// The roster template: just the header row, so nothing in it can be imported
// by accident. Behind sign-in like every other file.
export async function GET() {
  const access = await authorize(["coordinator", "admin"]);
  if (!access.ok) {
    return new Response("Not found", { status: access.error.code === "unauthenticated" ? 401 : 404 });
  }
  return new Response(`${rosterColumns.join(",")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="student-roster-template.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
