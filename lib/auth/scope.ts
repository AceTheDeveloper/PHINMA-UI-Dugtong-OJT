import type { Session } from "@/lib/auth/session";

// Scope checks, to run after the role check. Every action that touches a
// course, company, or student asks one of these before it writes.

export function canAccessCourse(session: Session, courseId: string): boolean {
  if (session.role === "admin") return true;
  return (
    (session.role === "coordinator" || session.role === "student") &&
    session.courseIds.includes(courseId)
  );
}

export function canAccessCompany(session: Session, companyId: string): boolean {
  if (session.role === "admin") return true;
  return session.role === "supervisor" && session.companyId === companyId;
}

export function isCompanyOwner(session: Session, companyId: string): boolean {
  return (
    session.role === "supervisor" &&
    session.isCompanyOwner &&
    session.companyId === companyId
  );
}

export function isOwnStudentRecord(session: Session, studentId: string): boolean {
  return session.role === "student" && session.studentId === studentId;
}
