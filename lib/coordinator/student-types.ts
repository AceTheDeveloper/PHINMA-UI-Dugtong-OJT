import type { ApplicationStatus } from "@/lib/applications/types";
import type { StudentStatus } from "@/lib/coordinator/types";
import type { SubmittedEvaluation } from "@/lib/evaluations/supervisor-types";
import type { LogStatus } from "@/lib/logs/types";
import type { ScheduleLine } from "@/lib/schedules/logic";

// One student as the coordinator sees them. Read only: nothing here can be
// changed from the screen.

export type StudentProfile = {
  id: string;
  name: string;
  studentNumber: string;
  email: string;
  isActive: boolean;
  courseLabel: string;
  batchLabel: string;
  requiredHours: number;
};

export type StudentApplicationRow = {
  id: string;
  status: ApplicationStatus;
  appliedAt: string;
  listingTitle: string;
  companyName: string;
};

export type StudentEntry = {
  id: string;
  logDate: string;
  timeIn: string;
  timeOut: string | null;
  breakMinutes: number;
  status: LogStatus;
  journal: string | null;
  rejectReason: string | null;
  earlyOutReason: string | null;
  correctionReason: string | null;
  reopenReason: string | null;
  // The supervisor recorded this day for a student who never timed in.
  addedBySupervisor: boolean;
};

export type StudentDeployment = {
  id: string;
  status: "active" | "completed" | "ended";
  companyName: string;
  startedAt: string;
  approvedHours: number;
  pendingEntries: number;
  // The schedule in force today, as lines; null when none has started.
  schedule: ScheduleLine[] | null;
  entries: StudentEntry[];
  evaluation: SubmittedEvaluation | null;
  // The issued certification, if the evaluation has been submitted.
  certificationId: string | null;
};

export type StudentView = {
  profile: StudentProfile;
  stage: StudentStatus;
  hasResume: boolean;
  applications: StudentApplicationRow[];
  // Newest first.
  deployments: StudentDeployment[];
};
