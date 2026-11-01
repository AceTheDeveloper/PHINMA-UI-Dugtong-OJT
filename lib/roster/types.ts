// Shapes passed between the roster actions and the roster screen. Plain data
// only, so they cross the server action boundary.

export type InviteState = "not_invited" | "pending" | "accepted" | "expired" | "revoked";

export type BatchOption = {
  id: string;
  courseId: string;
  label: string;
};

export type PreviewRow = {
  row: number;
  fullName: string;
  studentNumber: string;
  email: string;
  problems: string[];
};

export type Preview = {
  batchId: string;
  fileName: string;
  rows: PreviewRow[];
  ready: number;
  withProblems: number;
};

export type RosterStudent = {
  id: string;
  fullName: string;
  studentNumber: string;
  email: string;
  status: InviteState;
};

export type SendReport = {
  sent: number;
  failed: { studentId: string; name: string; message: string }[];
};
