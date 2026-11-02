// The supervisor's evaluation screens: who is ready, and one student's evaluation.

export type EvaluationQueueRow = {
  deploymentId: string;
  studentName: string;
  studentNumber: string;
  status: "active" | "completed" | "ended";
  approvedHours: number;
  requiredHours: number;
  // Entries the supervisor has not decided on yet. They do not block the
  // evaluation, but the approved hours would be higher once they are approved.
  pendingEntries: number;
  // Set once the evaluation is submitted.
  evaluatedAt: string | null;
  // Active, not yet evaluated, and approved hours at least the required hours.
  ready: boolean;
};

export type EvaluationCriterion = { id: string; label: string };

export type SubmittedEvaluation = {
  submittedAt: string;
  overallComment: string | null;
  formVersion: number;
  approvedHours: number;
  requiredHours: number;
  scores: { label: string; score: number; comment: string | null }[];
};

export type EvaluationDetail = {
  deploymentId: string;
  studentName: string;
  studentNumber: string;
  status: "active" | "completed" | "ended";
  approvedHours: number;
  requiredHours: number;
  pendingEntries: number;
  // The published form of the student's course, or null when there is none yet.
  form: { id: string; version: number; criteria: EvaluationCriterion[] } | null;
  submitted: SubmittedEvaluation | null;
};
