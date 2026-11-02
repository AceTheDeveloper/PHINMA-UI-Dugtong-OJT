import { describe, expect, it } from "vitest";
import {
  companyHours,
  progressBuckets,
  stageCounts,
  weeklySeries,
} from "@/lib/coordinator/charts";
import {
  companyRows,
  filterStudents,
  openEntriesBefore,
  staleEntries,
  summarize,
} from "@/lib/coordinator/metrics";
import { studentStatus } from "@/lib/coordinator/status";
import type { DashboardCompany, DashboardStudent, StudentStatus } from "@/lib/coordinator/types";

const required = 300;

describe("studentStatus", () => {
  const base = { openApplications: 0, approvedHours: 0, requiredHours: required };

  it.each([
    ["no deployment and no application", { deployments: [] }, "no-application"],
    ["an open application and no deployment", { deployments: [], openApplications: 2 }, "applying"],
    ["an active deployment below the hours", { deployments: [{ status: "active" }], approvedHours: 299.99 }, "active"],
    ["an active deployment with no hours at all", { deployments: [{ status: "active" }] }, "active"],
    ["an active deployment at exactly the required hours", { deployments: [{ status: "active" }], approvedHours: 300 }, "ready"],
    ["an active deployment over the required hours", { deployments: [{ status: "active" }], approvedHours: 312.5 }, "ready"],
    ["a completed deployment", { deployments: [{ status: "completed" }], approvedHours: 304 }, "completed"],
    ["only an ended deployment", { deployments: [{ status: "ended" }], approvedHours: 85 }, "ended"],
  ] as const)("is %s", (_name, input, expected) => {
    expect(studentStatus({ ...base, ...input } as Parameters<typeof studentStatus>[0])).toBe(expected);
  });

  it("lets a submitted evaluation win over everything else", () => {
    expect(
      studentStatus({
        ...base,
        deployments: [{ status: "ended" }, { status: "completed" }, { status: "active" }],
        openApplications: 3,
      }),
    ).toBe("completed");
  });

  it("lets a running deployment win over an open application and an ended one", () => {
    expect(
      studentStatus({
        ...base,
        deployments: [{ status: "ended" }, { status: "active" }],
        openApplications: 1,
      }),
    ).toBe("active");
  });

  it("shows a student whose deployment ended and who applied again as applying", () => {
    expect(studentStatus({ ...base, deployments: [{ status: "ended" }], openApplications: 1 })).toBe("applying");
  });

  it("never calls a student ready when the required hours are not known", () => {
    expect(
      studentStatus({ deployments: [{ status: "active" }], openApplications: 0, approvedHours: 50, requiredHours: 0 }),
    ).toBe("active");
  });
});

function student(id: string, status: StudentStatus, hours = 0, companyId: string | null = null): DashboardStudent {
  return {
    id,
    name: `Student ${id}`,
    studentNumber: `SN-${id}`,
    companyId,
    status,
    approvedHours: hours,
    pendingEntries: 0,
    lastEntryDate: null,
  };
}

const students: DashboardStudent[] = [
  student("1", "no-application"),
  student("2", "applying"),
  student("3", "active", 0, "c1"),
  student("4", "active", 74.99, "c1"),
  student("5", "active", 75, "c2"),
  student("6", "active", 224.99, "c2"),
  student("7", "ready", 300, "c1"),
  student("8", "ready", 312.5, "c3"),
  student("9", "completed", 304, "c3"),
  student("10", "ended", 85, "c2"),
];

describe("stageCounts", () => {
  it("counts each stage, in the order students move through them", () => {
    expect(stageCounts(students)).toEqual([
      { label: "No application", value: 1 },
      { label: "Applying", value: 1 },
      { label: "Active", value: 4 },
      { label: "Ready for evaluation", value: 2 },
      { label: "Completed", value: 1 },
      { label: "Ended", value: 1 },
    ]);
  });

  it("is all zeros for an empty course", () => {
    expect(stageCounts([]).every((bar) => bar.value === 0)).toBe(true);
    expect(stageCounts([])).toHaveLength(6);
  });
});

describe("progressBuckets", () => {
  it("puts each deployed student in their quarter, on the exact edges", () => {
    // 0 and 74.99 (24.997%), 75 (exactly 25%), 224.99 (74.997%), then 300, 312.5
    // and a completed student (100% or more).
    expect(progressBuckets(students, required)).toEqual([
      { label: "Under 25%", value: 2 },
      { label: "25 to 49%", value: 1 },
      { label: "50 to 74%", value: 1 },
      { label: "75 to 99%", value: 0 },
      { label: "100% or more", value: 3 },
    ]);
  });

  it("does not round a student who is just short of the requirement up into the finished bucket", () => {
    const buckets = progressBuckets([student("a", "active", 299.9)], required);
    expect(buckets.at(-1)?.value).toBe(0);
    expect(buckets[3].value).toBe(1);
  });

  it("leaves out students who are not deployed, and counts a completed student as finished whatever the hours", () => {
    const only = [student("a", "applying"), student("b", "ended", 85), student("c", "completed", 10)];
    const buckets = progressBuckets(only, required);
    expect(buckets.reduce((sum, bar) => sum + bar.value, 0)).toBe(1);
    expect(buckets.at(-1)?.value).toBe(1);
  });

  it("puts everyone in the first bucket when the required hours are not known", () => {
    expect(progressBuckets([student("a", "active", 50)], 0)[0].value).toBe(1);
  });
});

describe("companyHours", () => {
  const companies: DashboardCompany[] = [
    { id: "c1", name: "Northwind", supervisors: 1 },
    { id: "c2", name: "Bluepeak", supervisors: 1 },
    { id: "c3", name: "Harbor", supervisors: 2 },
    { id: "c4", name: "Empty Co", supervisors: 0 },
  ];

  it("sums approved hours per company, largest first, leaving out a company with none", () => {
    // Harbor 312.5 + 304, Bluepeak 75 + 224.99 + 85, Northwind 0 + 74.99 + 300.
    expect(companyHours(companies, students)).toEqual([
      { label: "Harbor", value: 616.5 },
      { label: "Bluepeak", value: 384.99 },
      { label: "Northwind", value: 374.99 },
    ]);
  });

  it("breaks a tie by name, and ignores students with no company", () => {
    const bars = companyHours(
      [
        { id: "a", name: "Beta", supervisors: 0 },
        { id: "b", name: "Alpha", supervisors: 0 },
      ],
      [student("1", "active", 10, "a"), student("2", "active", 10, "b"), student("3", "active", 99)],
    );
    expect(bars.map((bar) => bar.label)).toEqual(["Alpha", "Beta"]);
  });
});

describe("weeklySeries", () => {
  it("labels each week by the day it starts, in school time, and keeps the order and hours", () => {
    expect(
      weeklySeries([
        { weekStart: "2026-10-05", hours: 0 },
        { weekStart: "2026-10-12", hours: 36.5 },
      ]),
    ).toEqual([
      { label: "Oct 5", value: 0 },
      { label: "Oct 12", value: 36.5 },
    ]);
  });
});

describe("the helpers the cards and the table use", () => {
  it("summarizes the cards from the same rows", () => {
    expect(summarize(students)).toEqual({ total: 10, active: 4, notDeployed: 2, ready: 2, evaluated: 1 });
  });

  it("finds stale pending entries (longer than the threshold), longest wait first", () => {
    const entries = [
      { id: "a", studentId: "1", date: "2026-10-30", daysWaiting: 3 },
      { id: "b", studentId: "1", date: "2026-10-28", daysWaiting: 5 },
      { id: "c", studentId: "2", date: "2026-10-27", daysWaiting: 6 },
    ];
    expect(staleEntries(entries, 3).map((entry) => entry.id)).toEqual(["c", "b"]);
  });

  it("finds entries never timed out from an earlier day", () => {
    const entries = [
      { id: "a", studentId: "1", date: "2026-11-01" },
      { id: "b", studentId: "1", date: "2026-11-03" },
    ];
    expect(openEntriesBefore(entries, "2026-11-03").map((entry) => entry.id)).toEqual(["a"]);
  });

  it("counts active and ready students and their hours for a company", () => {
    const rows = companyRows([{ id: "c1", name: "Northwind", supervisors: 1 }], students);
    expect(rows[0]).toMatchObject({ activeStudents: 3, approvedHours: 374.99 });
  });

  it("filters by name or student number, status, and company, and sorts by progress", () => {
    const base = { query: "", status: "all" as const, company: "all", sort: "progress-desc" as const };
    expect(filterStudents(students, { ...base, query: "sn-7" }).map((s) => s.id)).toEqual(["7"]);
    expect(filterStudents(students, { ...base, status: "ready" }).map((s) => s.id)).toEqual(["8", "7"]);
    expect(filterStudents(students, { ...base, company: "none" }).map((s) => s.id).sort()).toEqual(["1", "2"]);
    expect(filterStudents(students, { ...base, company: "c3" }).map((s) => s.id)).toEqual(["8", "9"]);
  });
});
