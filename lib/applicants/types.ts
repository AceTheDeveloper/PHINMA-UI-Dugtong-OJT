import type { ApplicationStatus } from "@/lib/applications/types";

// An application to one of the supervisor's company listings.
export type Applicant = {
  id: string;
  status: ApplicationStatus;
  appliedAt: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  listingTitle: string;
  hasResume: boolean;
};

export type SupervisorSummary = {
  openListings: number;
  waitingApplicants: number;
  activeStudents: number;
};
