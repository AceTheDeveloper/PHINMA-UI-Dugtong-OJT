import type { Session } from "@/lib/auth/session";
import type { CertificationAccess } from "@/lib/certification/types";

// Who may have a certification's PDF. A voided certification is for nobody: its
// snapshot stays as history, but a file that looks valid must not be handed out.
// The supervisor never gets it (the permissions table gives them no access).
export function canDownloadCertification(session: Session, cert: CertificationAccess): boolean {
  if (cert.status !== "issued") return false;
  switch (session.role) {
    case "student":
      return session.studentId !== null && session.studentId === cert.studentId;
    case "coordinator":
      return session.courseIds.includes(cert.courseId);
    case "admin":
      return true;
    default:
      return false;
  }
}
