import "server-only";
import { getAllCourseIds } from "@/lib/admin/queries";
import { getCertificationsForCourses } from "@/lib/certification/queries";
import type { CertificationSummary } from "@/lib/certification/types";
import { ok, type Result } from "@/lib/result";

// Reads for the Platform Admin certifications view.
// Calls getAllCourseIds() and retrieves all certifications across all courses.

export async function getAdminCertifications(): Promise<Result<CertificationSummary[]>> {
  const courseIdsResult = await getAllCourseIds();
  if (!courseIdsResult.ok) return courseIdsResult;
  if (courseIdsResult.data.length === 0) return ok([]);
  return getCertificationsForCourses(courseIdsResult.data);
}
