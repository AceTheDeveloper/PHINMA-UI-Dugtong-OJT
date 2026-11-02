import { describe, expect, it } from "vitest";
import { canDownloadCertification } from "@/lib/certification/access";
import { fillTemplate, hoursText, longDate, longDateOfInstant } from "@/lib/certification/template";
import type { CertificateData, CertificationAccess } from "@/lib/certification/types";
import type { Role } from "@/lib/auth/roles";
import type { Session } from "@/lib/auth/session";

const data: CertificateData = {
  id: "cert-1",
  studentName: "DELA CRUZ, JUAN",
  studentNumber: "04-2122-000001",
  courseName: "BS Information Technology",
  companyName: "Acme Inc.",
  supervisorName: "Supervisor Reyes",
  issuerName: "Coordinator Cruz",
  approvedHours: 486.05,
  requiredHours: 485,
  startDate: "2026-08-18",
  endDate: "2026-10-30",
  issuedAt: "2026-11-03T02:00:00Z",
  heading: "Certificate of completion",
  body: "",
  signatories: [
    { name: "Person 1", title: "Signatory" },
    { name: "Person 2", title: "Signatory" },
  ],
};

describe("dates and hours", () => {
  it("writes a school date in full", () => {
    expect(longDate("2026-08-18")).toBe("August 18, 2026");
    expect(longDate("2026-01-01")).toBe("January 1, 2026");
    expect(longDate("2026-12-31")).toBe("December 31, 2026");
  });

  it("writes a timestamp in school time, so the evening in Manila is the next day in UTC", () => {
    expect(longDateOfInstant("2026-11-03T02:00:00Z")).toBe("November 3, 2026");
    expect(longDateOfInstant("2026-11-02T17:00:00Z")).toBe("November 3, 2026");
    expect(longDateOfInstant("2026-11-02T15:59:00Z")).toBe("November 2, 2026");
  });

  it("writes whole hours without decimals and others with two", () => {
    expect(hoursText(486)).toBe("486");
    expect(hoursText(486.05)).toBe("486.05");
    expect(hoursText(485.5)).toBe("485.50");
  });
});

describe("fillTemplate", () => {
  it("fills every known placeholder", () => {
    expect(
      fillTemplate(
        "{student} ({student_number}) of {course} did {hours} h at {company} from {start} to {end}.",
        data,
      ),
    ).toBe(
      "DELA CRUZ, JUAN (04-2122-000001) of BS Information Technology did 486.05 h at Acme Inc. from August 18, 2026 to October 30, 2026.",
    );
  });

  it("fills a placeholder used twice, and text with none", () => {
    expect(fillTemplate("{student} and {student}", data)).toBe("DELA CRUZ, JUAN and DELA CRUZ, JUAN");
    expect(fillTemplate("Plain text.", data)).toBe("Plain text.");
  });

  it("leaves an unknown placeholder as written, so a typo is visible", () => {
    expect(fillTemplate("Hello {studnet} and {student}", data)).toBe("Hello {studnet} and DELA CRUZ, JUAN");
  });

  it("does not run a dollar sign or backslash in a name as a replacement pattern", () => {
    expect(fillTemplate("{student}", { ...data, studentName: "A$&B\\1" })).toBe("A$&B\\1");
  });
});

function session(role: Role, over: Partial<Session> = {}): Session {
  return {
    userId: "user-1",
    clerkId: "clerk-1",
    role,
    studentId: null,
    courseIds: [],
    companyId: null,
    isCompanyOwner: false,
    hasConsent: true,
    ...over,
  };
}

const cert: CertificationAccess = { status: "issued", studentId: "student-1", courseId: "course-1" };

describe("canDownloadCertification", () => {
  it("lets the student have their own, and nobody else's", () => {
    expect(canDownloadCertification(session("student", { studentId: "student-1" }), cert)).toBe(true);
    expect(canDownloadCertification(session("student", { studentId: "student-2" }), cert)).toBe(false);
    expect(canDownloadCertification(session("student", { studentId: null }), cert)).toBe(false);
  });

  it("lets a coordinator have those of their own courses only", () => {
    expect(canDownloadCertification(session("coordinator", { courseIds: ["course-1", "x"] }), cert)).toBe(true);
    expect(canDownloadCertification(session("coordinator", { courseIds: ["course-2"] }), cert)).toBe(false);
    expect(canDownloadCertification(session("coordinator", { courseIds: [] }), cert)).toBe(false);
  });

  it("lets the admin have any", () => {
    expect(canDownloadCertification(session("admin"), cert)).toBe(true);
  });

  it("never lets a supervisor have one, even of their own company's student", () => {
    expect(canDownloadCertification(session("supervisor", { companyId: "company-1" }), cert)).toBe(false);
  });

  it.each(["student", "coordinator", "admin"] as const)("never hands a voided one to a %s", (role) => {
    const voided: CertificationAccess = { ...cert, status: "voided" };
    expect(
      canDownloadCertification(
        session(role, { studentId: "student-1", courseIds: ["course-1"] }),
        voided,
      ),
    ).toBe(false);
  });
});
