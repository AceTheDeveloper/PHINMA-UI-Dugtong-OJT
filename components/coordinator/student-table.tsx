"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DtrLink } from "@/components/export/download-link";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  filterStudents,
  formatDate,
  formatHours,
  progressPercent,
  type CompanyFilter,
  type SortKey,
  type StatusFilter,
} from "@/lib/coordinator/metrics";
import type { DashboardCompany, DashboardStudent } from "@/lib/coordinator/types";
import { StudentStatusBadge, studentStatuses } from "./status-badge";

type Option = { value: string; label: string };

const statusOptions: Option[] = [
  { value: "all", label: "All statuses" },
  ...Object.entries(studentStatuses).map(([value, { label }]) => ({
    value,
    label,
  })),
];

const sortOptions: Option[] = [
  { value: "progress-desc", label: "Most hours first" },
  { value: "progress-asc", label: "Fewest hours first" },
  { value: "name", label: "Name" },
];

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <Select
        value={value}
        items={options}
        onValueChange={(next) => {
          if (next !== null) onChange(next);
        }}
      >
        <SelectTrigger aria-label={label} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Hours({ student, requiredHours }: { student: DashboardStudent; requiredHours: number }) {
  const percent = progressPercent(student.approvedHours, requiredHours);
  return (
    <div className="grid min-w-36 gap-1.5">
      <span className="text-sm tabular-nums">
        {formatHours(student.approvedHours)} / {requiredHours} h
      </span>
      <Progress
        value={percent}
        aria-label={`${student.name}: ${formatHours(student.approvedHours)} of ${requiredHours} hours`}
        className="gap-0"
      />
    </div>
  );
}

export function StudentTable({
  students,
  companies,
  courses,
  requiredHours,
  basePath = "/coordinator/students",
}: {
  students: DashboardStudent[];
  companies: DashboardCompany[];
  courses?: { id: string; label: string }[];
  requiredHours: number;
  basePath?: string;
}) {
  const companyNames = useMemo(
    () => new Map(companies.map((company) => [company.id, company.name])),
    [companies],
  );
  const companyOptions: Option[] = useMemo(
    () => [
      { value: "all", label: "All companies" },
      ...companies.map((company) => ({ value: company.id, label: company.name })),
      { value: "none", label: "No company" },
    ],
    [companies],
  );
  const courseOptions: Option[] = useMemo(
    () =>
      courses
        ? [{ value: "all", label: "All courses" }, ...courses.map((c) => ({ value: c.id, label: c.label }))]
        : [],
    [courses],
  );
  const companyOf = (student: DashboardStudent) =>
    student.companyId ? (companyNames.get(student.companyId) ?? "Unknown") : "No company";

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [company, setCompany] = useState<CompanyFilter>("all");
  const [course, setCourse] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("progress-desc");

  const rows = useMemo(
    () => filterStudents(students, { query, status, company, course, sort }),
    [students, query, status, company, course, sort],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="font-heading text-base font-bold">
          Student progress
        </CardTitle>
        <CardDescription>
          Approved hours toward {requiredHours} required hours. Read-only.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div
          className={cn(
            "grid gap-3 sm:grid-cols-2",
            courses && courses.length > 0 ? "lg:grid-cols-5" : "lg:grid-cols-4",
          )}
        >
          <div className="grid gap-1.5">
            <label htmlFor="student-search" className="text-xs font-semibold text-muted-foreground">
              Search
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-faint"
              />
              <Input
                id="student-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name or student ID"
                className="pl-8"
              />
            </div>
          </div>
          {courses && courses.length > 0 ? (
            <FilterSelect
              label="Course"
              value={course}
              options={courseOptions}
              onChange={(value) => setCourse(value)}
            />
          ) : null}
          <FilterSelect
            label="Status"
            value={status}
            options={statusOptions}
            onChange={(value) => setStatus(value as StatusFilter)}
          />
          <FilterSelect
            label="Company"
            value={company}
            options={companyOptions}
            onChange={(value) => setCompany(value as CompanyFilter)}
          />
          <FilterSelect
            label="Sort by"
            value={sort}
            options={sortOptions}
            onChange={(value) => setSort(value as SortKey)}
          />
        </div>

        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          Showing {rows.length} of {students.length} students.
        </p>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-strong px-4 py-8 text-center text-sm text-muted-foreground">
            No students match these filters. Clear the search or change a filter.
          </p>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approved hours</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead>Last entry</TableHead>
                    <TableHead>
                      <span className="sr-only">Daily time record</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <Link
                          href={`${basePath}/${student.id}`}
                          className="font-semibold text-ink underline-offset-4 hover:text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {student.name}
                        </Link>
                        <p className="font-mono text-xs text-muted-foreground">
                          {student.studentNumber}
                          {student.courseCode ? ` · ${student.courseCode}` : ""}
                        </p>
                      </TableCell>
                      <TableCell>{companyOf(student)}</TableCell>
                      <TableCell>
                        <StudentStatusBadge status={student.status} />
                      </TableCell>
                      <TableCell>
                        <Hours student={student} requiredHours={requiredHours} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {student.pendingEntries}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {student.lastEntryDate ? formatDate(student.lastEntryDate) : "None yet"}
                      </TableCell>
                      <TableCell>
                        {student.deploymentId ? (
                          <DtrLink deploymentId={student.deploymentId} name={student.name} />
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="grid gap-3 md:hidden">
              {rows.map((student) => (
                <li
                  key={student.id}
                  className="grid gap-3 rounded-lg border border-border bg-surface p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`${basePath}/${student.id}`}
                        className="block min-h-6 truncate font-semibold text-ink underline-offset-4 hover:text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:min-h-11 pointer-coarse:leading-[44px]"
                      >
                        {student.name}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground">
                        {student.studentNumber}
                        {student.courseCode ? ` · ${student.courseCode}` : ""}
                      </p>
                    </div>
                    <StudentStatusBadge status={student.status} />
                  </div>
                  <Hours student={student} requiredHours={requiredHours} />
                  <dl className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Company</dt>
                      <dd className="font-semibold text-ink">{companyOf(student)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Pending</dt>
                      <dd className="font-semibold tabular-nums text-ink">{student.pendingEntries}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Last entry</dt>
                      <dd className="font-semibold tabular-nums text-ink">
                        {student.lastEntryDate ? formatDate(student.lastEntryDate) : "None yet"}
                      </dd>
                    </div>
                  </dl>
                  {student.deploymentId ? (
                    <div>
                      <DtrLink deploymentId={student.deploymentId} name={student.name} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
