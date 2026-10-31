"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  filterStudents,
  formatDate,
  formatHours,
  progressPercent,
  type CompanyFilter,
  type SortKey,
  type StatusFilter,
} from "@/lib/coordinator/metrics";
import {
  mockCompanies,
  mockCourse,
  mockStudents,
  type MockStudent,
} from "@/lib/mock/coordinator";
import { StudentStatusBadge, studentStatuses } from "./status-badge";

type Option = { value: string; label: string };

const statusOptions: Option[] = [
  { value: "all", label: "All statuses" },
  ...Object.entries(studentStatuses).map(([value, { label }]) => ({
    value,
    label,
  })),
];

const companyOptions: Option[] = [
  { value: "all", label: "All companies" },
  ...mockCompanies.map((c) => ({ value: c.id, label: c.name })),
  { value: "none", label: "No company" },
];

const sortOptions: Option[] = [
  { value: "progress-desc", label: "Most hours first" },
  { value: "progress-asc", label: "Fewest hours first" },
  { value: "name", label: "Name" },
];

const companyNames = new Map(mockCompanies.map((c) => [c.id, c.name]));

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

function Hours({ student }: { student: MockStudent }) {
  const percent = progressPercent(student.approvedHours, mockCourse.requiredHours);
  return (
    <div className="grid min-w-36 gap-1.5">
      <span className="text-sm tabular-nums">
        {formatHours(student.approvedHours)} / {mockCourse.requiredHours} h
      </span>
      <Progress
        value={percent}
        aria-label={`${student.name}: ${formatHours(student.approvedHours)} of ${mockCourse.requiredHours} hours`}
        className="gap-0"
      />
    </div>
  );
}

function companyOf(student: MockStudent) {
  return student.companyId ? (companyNames.get(student.companyId) ?? "Unknown") : "No company";
}

export function StudentTable() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [company, setCompany] = useState<CompanyFilter>("all");
  const [sort, setSort] = useState<SortKey>("progress-desc");

  const rows = useMemo(
    () => filterStudents(mockStudents, { query, status, company, sort }),
    [query, status, company, sort],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="font-heading text-base font-bold">
          Student progress
        </CardTitle>
        <CardDescription>
          Approved hours toward {mockCourse.requiredHours} required hours. Read-only.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          Showing {rows.length} of {mockStudents.length} students.
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <p className="font-semibold text-ink">{student.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {student.studentNumber}
                        </p>
                      </TableCell>
                      <TableCell>{companyOf(student)}</TableCell>
                      <TableCell>
                        <StudentStatusBadge status={student.status} />
                      </TableCell>
                      <TableCell>
                        <Hours student={student} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {student.pendingEntries}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {student.lastEntryDate ? formatDate(student.lastEntryDate) : "None yet"}
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
                      <p className="truncate font-semibold text-ink">{student.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {student.studentNumber}
                      </p>
                    </div>
                    <StudentStatusBadge status={student.status} />
                  </div>
                  <Hours student={student} />
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
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
