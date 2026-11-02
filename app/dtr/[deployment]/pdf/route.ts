import { authorize } from "@/lib/auth/server";
import { canDownloadDtr } from "@/lib/dtr/access";
import { generateDtrPdf } from "@/lib/dtr/pdf";
import { getDtr } from "@/lib/dtr/queries";

// A deployment's DTR, drawn on request from its approved entries. No public link
// and no stored file: the visitor must be signed in and allowed this student (the
// student's own, a supervisor's company, a coordinator's course, or the admin).
// Any refusal answers "not found", so the answer does not reveal which exist.

function safeName(value: string): string {
  return value.replace(/[^A-Za-z0-9-]/g, "") || "student";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ deployment: string }> },
) {
  const session = await authorize(["student", "supervisor", "coordinator", "admin"]);
  if (!session.ok) {
    return new Response("Not found", { status: session.error.code === "unauthenticated" ? 401 : 404 });
  }

  const { deployment } = await params;
  const found = await getDtr(deployment);
  if (!found.ok) return new Response("Something went wrong", { status: 500 });
  if (!found.data || !canDownloadDtr(session.data, found.data.access)) {
    return new Response("Not found", { status: 404 });
  }

  const pdf = await generateDtrPdf(found.data.data);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="dtr-${safeName(found.data.data.studentNumber)}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
