import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/admin-parts";
import { ResumeUploader } from "@/components/resume/resume-uploader";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/server";
import { getOwnResume } from "@/lib/resume/queries";

export const metadata: Metadata = {
  title: "Resume · Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function ResumePage() {
  const session = await requireRole(["student"]);
  if (!session.studentId) throw new Error("This account has no student record.");
  const resume = await getOwnResume(session.studentId);
  if (!resume.ok) throw new Error(resume.error.message);

  return (
    <>
      <PageHeader
        title="Resume"
        description="Upload your resume as a PDF of up to 2 MB. Your coordinator and the supervisors of companies you apply to can open it."
      />
      <Card className="w-full max-w-xl">
        <CardContent>
          <ResumeUploader studentId={session.studentId} current={resume.data} />
        </CardContent>
      </Card>
    </>
  );
}
