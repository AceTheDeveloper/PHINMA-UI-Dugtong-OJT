import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResumeUploader } from "@/components/resume/resume-uploader";
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
    <AuthShell maxWidth="max-w-[560px]">
      <h1 className="font-heading text-[28px] font-extrabold leading-[1.2] tracking-[-0.04em]">
        Resume
      </h1>
      <p className="mt-3 text-base leading-[1.65] text-copy-muted">
        Upload your resume as a PDF of up to 2 MB. Your coordinator and the
        supervisors of companies you apply to can open it.
      </p>
      <div className="mt-7">
        <ResumeUploader studentId={session.studentId} current={resume.data} />
      </div>
    </AuthShell>
  );
}
