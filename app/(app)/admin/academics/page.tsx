import type { Metadata } from "next";
import {
  BatchStatusBadge,
  EmptyState,
  LoadError,
  PageHeader,
  Section,
} from "@/components/admin/admin-parts";
import {
  AddBatchSheet,
  AddCourseSheet,
  AddDepartmentSheet,
  EditHoursSheet,
} from "@/components/admin/forms";
import { HistorySection } from "@/components/admin/history-section";
import { RoleBadge } from "@/components/coordinator/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatHours, formatPlainDate } from "@/lib/admin/format";
import { getAcademics } from "@/lib/admin/queries";
import { requireRole } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Academics | Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function AcademicsPage() {
  await requireRole(["admin"]);
  const result = await getAcademics();

  const departments = result.ok ? result.data : [];
  const departmentOptions = departments.map((department) => ({
    value: department.id,
    label: `${department.code} · ${department.name}`,
  }));
  const courseOptions = departments.flatMap((department) =>
    department.courses.map((course) => ({
      value: course.id,
      label: `${course.code} · ${department.code}`,
    })),
  );

  return (
    <>
      <PageHeader
        title="Academics"
        description="Departments, their courses, and each course's OJT batches. Required hours are set per batch."
        actions={
          <>
            <AddDepartmentSheet />
            <AddCourseSheet departments={departmentOptions} />
            <AddBatchSheet courses={courseOptions} />
          </>
        }
      />

      {!result.ok ? (
        <LoadError message={result.error.message} />
      ) : departments.length === 0 ? (
        <EmptyState>Add a department to start, for example CITE.</EmptyState>
      ) : (
        departments.map((department) => (
          <Section
            key={department.id}
            title={`${department.code} · ${department.name}`}
            description={
              department.courses.length === 0
                ? "No courses yet."
                : `${department.courses.length} ${department.courses.length === 1 ? "course" : "courses"}`
            }
            actions={
              department.isActive ? undefined : <RoleBadge role="neutral">Inactive</RoleBadge>
            }
          >
            {department.courses.length === 0 ? (
              <EmptyState>Add a course to this department.</EmptyState>
            ) : (
              <div className="grid gap-6">
                {department.courses.map((course) => (
                  <div key={course.id} className="grid gap-2">
                    <h3 className="text-sm font-semibold text-ink">
                      {course.code} · {course.name}
                    </h3>
                    {course.batches.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No OJT batch yet. Add one to set the required hours.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>School year</TableHead>
                            <TableHead className="text-right">Required hours</TableHead>
                            <TableHead>Starts</TableHead>
                            <TableHead>Ends</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">
                              <span className="sr-only">Actions</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {course.batches.map((batch) => (
                            <TableRow key={batch.id}>
                              <TableCell className="font-medium tabular-nums">
                                {batch.schoolYear}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatHours(batch.requiredHours)}
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {formatPlainDate(batch.startsOn)}
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {formatPlainDate(batch.endsOn)}
                              </TableCell>
                              <TableCell>
                                <BatchStatusBadge status={batch.status} />
                              </TableCell>
                              <TableCell className="text-right">
                                <EditHoursSheet
                                  batchId={batch.id}
                                  label={`${course.code} · ${batch.schoolYear}`}
                                  current={batch.requiredHours}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        ))
      )}

      <HistorySection
        filter={{ tables: ["departments", "courses", "ojt_batches"] }}
        description="Changes to departments, courses, and OJT batches, including required hours."
      />
    </>
  );
}
