import type {
  MockCompany,
  MockOpenEntry,
  MockPendingEntry,
  MockStudent,
  StudentStatus,
} from "@/lib/mock/coordinator";

export type StatusFilter = StudentStatus | "all";
export type CompanyFilter = string | "all" | "none";
export type SortKey = "progress-desc" | "progress-asc" | "name";

export type StudentFilters = {
  query: string;
  status: StatusFilter;
  company: CompanyFilter;
  sort: SortKey;
};

export type Summary = {
  total: number;
  active: number;
  notDeployed: number;
  ready: number;
  evaluated: number;
};

export function progressPercent(approvedHours: number, requiredHours: number) {
  if (requiredHours <= 0) return 0;
  return Math.min(100, Math.round((approvedHours / requiredHours) * 100));
}

export function summarize(students: MockStudent[]): Summary {
  return {
    total: students.length,
    active: students.filter((s) => s.status === "active").length,
    notDeployed: students.filter(
      (s) => s.status === "applying" || s.status === "no-application",
    ).length,
    ready: students.filter((s) => s.status === "ready").length,
    evaluated: students.filter((s) => s.status === "completed").length,
  };
}

export function filterStudents(
  students: MockStudent[],
  filters: StudentFilters,
): MockStudent[] {
  const query = filters.query.trim().toLowerCase();

  const matches = students.filter((student) => {
    if (
      query &&
      !student.name.toLowerCase().includes(query) &&
      !student.studentNumber.toLowerCase().includes(query)
    ) {
      return false;
    }
    if (filters.status !== "all" && student.status !== filters.status) {
      return false;
    }
    if (filters.company === "none") return student.companyId === null;
    if (filters.company !== "all" && student.companyId !== filters.company) {
      return false;
    }
    return true;
  });

  return [...matches].sort((a, b) => {
    if (filters.sort === "name") return a.name.localeCompare(b.name);
    const diff = a.approvedHours - b.approvedHours;
    return filters.sort === "progress-asc" ? diff : -diff;
  });
}

export function staleEntries(
  entries: MockPendingEntry[],
  thresholdDays: number,
): MockPendingEntry[] {
  return entries
    .filter((entry) => entry.daysWaiting > thresholdDays)
    .sort((a, b) => b.daysWaiting - a.daysWaiting);
}

export function openEntriesBefore(
  entries: MockOpenEntry[],
  today: string,
): MockOpenEntry[] {
  return entries.filter((entry) => entry.date < today);
}

export type CompanyRow = {
  company: MockCompany;
  activeStudents: number;
  approvedHours: number;
};

export function companyRows(
  companies: MockCompany[],
  students: MockStudent[],
): CompanyRow[] {
  return companies.map((company) => {
    const mine = students.filter((s) => s.companyId === company.id);
    return {
      company,
      activeStudents: mine.filter(
        (s) => s.status === "active" || s.status === "ready",
      ).length,
      approvedHours: mine.reduce((sum, s) => sum + s.approvedHours, 0),
    };
  });
}

export function formatHours(hours: number) {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

const dateFormat = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  month: "short",
  day: "numeric",
});

export function formatDate(iso: string) {
  return dateFormat.format(new Date(iso.length === 10 ? `${iso}T00:00:00+08:00` : iso));
}
