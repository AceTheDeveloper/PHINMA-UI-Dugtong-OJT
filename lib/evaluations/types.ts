// The evaluation form as the coordinator screen sees it. A course has at most one
// published form (the one supervisors use) and one draft (the next version).

export type EvaluationForm = {
  id: string;
  version: number;
  status: "draft" | "published";
  publishedAt: string | null;
  criteria: string[];
};

export type CourseForms = {
  courseId: string;
  courseLabel: string;
  published: EvaluationForm | null;
  draft: EvaluationForm | null;
};
