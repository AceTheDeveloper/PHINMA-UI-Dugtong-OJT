import { canDownloadCertification } from "@/lib/certification/access";
import { generateCertificatePdf } from "@/lib/certification/pdf";
import { getCertificationForPdf } from "@/lib/certification/queries";
import { authorize } from "@/lib/auth/server";

// A certification's PDF, drawn on request from its stored snapshot. There is no
// public link and no stored file: the visitor must be signed in and allowed this
// certification (the student's own, a coordinator's course, or the admin). Any
// refusal answers "not found", so the answer does not reveal which exist.

const notFound = () => new Response("Not found", { status: 404 });

function safeName(value: string): string {
  return value.replace(/[^A-Za-z0-9-]/g, "") || "student";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await authorize(["student", "coordinator", "admin"]);
  if (!session.ok) {
    return new Response("Not found", { status: session.error.code === "unauthenticated" ? 401 : 404 });
  }

  const { id } = await params;
  const found = await getCertificationForPdf(id);
  if (!found.ok) return new Response("Something went wrong", { status: 500 });
  if (!found.data || !canDownloadCertification(session.data, found.data.access)) return notFound();

  const pdf = await generateCertificatePdf(found.data.data);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certification-${safeName(found.data.data.studentNumber)}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
