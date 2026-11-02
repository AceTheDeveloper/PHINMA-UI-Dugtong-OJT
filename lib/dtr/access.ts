import type { Session } from "@/lib/auth/session";
import type { DtrAccess } from "@/lib/dtr/types";

// Who may have a deployment's DTR (AGENTS.md section 4, "View and export reports,
// DTR PDF"): the student (own), a supervisor (their own company's students), a
// coordinator (their course), and the admin (all).
export function canDownloadDtr(session: Session, dtr: DtrAccess): boolean {
  switch (session.role) {
    case "student":
      return session.studentId !== null && session.studentId === dtr.studentId;
    case "supervisor":
      return session.companyId !== null && session.companyId === dtr.companyId;
    case "coordinator":
      return session.courseIds.includes(dtr.courseId);
    case "admin":
      return true;
    default:
      return false;
  }
}
