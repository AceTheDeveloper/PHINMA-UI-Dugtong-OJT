// A certification is a snapshot: every fact on the certificate as it was when the
// supervisor submitted the evaluation. The PDF is drawn from this alone.

export type CertificateData = {
  id: string;
  studentName: string;
  studentNumber: string;
  courseName: string;
  companyName: string;
  supervisorName: string;
  issuerName: string;
  approvedHours: number;
  requiredHours: number;
  // School dates (YYYY-MM-DD): the first and last approved day.
  startDate: string;
  endDate: string;
  issuedAt: string;
  heading: string;
  body: string;
  signatories: [
    { name: string; title: string },
    { name: string; title: string },
  ];
};

export type CertificationSummary = {
  id: string;
  status: "issued" | "voided";
  studentName: string;
  studentNumber: string;
  courseName: string;
  companyName: string;
  approvedHours: number;
  startDate: string;
  endDate: string;
  issuedAt: string;
};

// What the download route needs to decide who may have the file.
export type CertificationAccess = {
  status: "issued" | "voided";
  studentId: string;
  courseId: string;
};

export type CertificateTemplate = {
  courseId: string;
  courseLabel: string;
  signatories: [
    { name: string; title: string },
    { name: string; title: string },
  ];
};
