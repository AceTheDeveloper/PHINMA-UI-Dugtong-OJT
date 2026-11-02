import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/roles";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type Call = { table: string; filters: [string, unknown][] };
const calls: Call[] = [];
const results: Record<string, unknown> = {};
let failTable: string | null = null;

function builder(table: string) {
  const call: Call = { table, filters: [] };
  calls.push(call);
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.order = () => chain;
  chain.limit = () => chain;
  chain.eq = (column: string, value: unknown) => {
    call.filters.push([`eq:${column}`, value]);
    return chain;
  };
  chain.in = (column: string, value: unknown) => {
    call.filters.push([`in:${column}`, value]);
    return chain;
  };
  chain.then = (resolve: (value: unknown) => unknown) => {
    if (failTable === table) return resolve({ data: null, error: { message: "database error" } });
    return resolve({ data: results[table] ?? [], error: null });
  };
  return chain;
}

vi.mock("@/lib/db/admin", () => ({ adminClient: () => ({ from: builder }) }));

const mockRequireRole = vi.fn();
vi.mock("@/lib/auth/server", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
  authorize: vi.fn(),
}));

const mockRpcChanged = vi.fn();
vi.mock("@/lib/db/rpc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db/rpc")>("@/lib/db/rpc");
  return {
    ...actual,
    adminReopenEvaluation: (...args: unknown[]) => mockRpcChanged(...args),
  };
});

const { authorize } = vi.mocked(await import("@/lib/auth/server"));
const { getAdminEvaluations } = await import("@/lib/admin/evaluation-queries");
const AdminEvaluationsPage = (await import("@/app/(app)/admin/evaluations/page")).default;
const { reopenEvaluation } = await import("@/app/(app)/admin/actions");

const studentId = "00000000-0000-4000-8000-0000000000a1";
const evaluationId = "00000000-0000-4000-8000-0000000000e1";
const certId = "00000000-0000-4000-8000-0000000000c1";

function seed() {
  results.evaluations = [
    {
      id: evaluationId,
      deployment_id: "dep-1",
      submitted_at: "2026-11-02T10:00:00Z",
      overall_comment: "Outstanding performance throughout.",
      approved_hours: "300.00",
      required_hours: "300.00",
      form: { version: 1 },
      evaluator: { full_name: "Maria Supervisor" },
      deployment: {
        student: { id: studentId, full_name: "DELA CRUZ, JUAN", student_number: "SN-1" },
        company: { id: "comp-1", name: "Tech Corp" },
      },
      scores: [
        { score: 5, comment: "Excellent", criterion: { label: "Technical Skill", position: 1 } },
        { score: 4, comment: "Punctual", criterion: { label: "Attendance", position: 2 } },
      ],
      certifications: [{ id: certId, status: "issued" }],
    },
  ];
}

describe("getAdminEvaluations", () => {
  beforeEach(() => {
    calls.length = 0;
    failTable = null;
    seed();
  });

  it("queries and maps all evaluations with criteria, scores, and certification status", async () => {
    const result = await getAdminEvaluations();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(1);
    const item = result.data[0];
    expect(item.id).toBe(evaluationId);
    expect(item.studentName).toBe("DELA CRUZ, JUAN");
    expect(item.companyName).toBe("Tech Corp");
    expect(item.evaluatorName).toBe("Maria Supervisor");
    expect(item.approvedHours).toBe(300);
    expect(item.requiredHours).toBe(300);
    expect(item.certificationId).toBe(certId);
    expect(item.certificationStatus).toBe("issued");
    expect(item.scores).toHaveLength(2);
    expect(item.scores[0].label).toBe("Technical Skill");
    expect(item.scores[0].score).toBe(5);
    expect(item.scores[1].label).toBe("Attendance");
    expect(item.scores[1].score).toBe(4);
  });

  it("returns database error when query fails", async () => {
    failTable = "evaluations";
    const result = await getAdminEvaluations();
    expect(result.ok).toBe(false);
  });
});

describe("AdminEvaluationsPage access control", () => {
  beforeEach(() => {
    calls.length = 0;
    failTable = null;
    seed();
    mockRequireRole.mockReset();
  });

  it("allows admin access to /admin/evaluations and renders evaluations list", async () => {
    mockRequireRole.mockResolvedValueOnce({
      userId: "u1",
      role: "admin" as Role,
      courseIds: [],
    });
    const page = await AdminEvaluationsPage();
    expect(page).toBeDefined();
    expect(mockRequireRole).toHaveBeenCalledWith(["admin"]);
  });

  it("refuses non-admin roles", async () => {
    mockRequireRole.mockRejectedValueOnce(new Error("REDIRECT_NO_ACCESS"));
    await expect(AdminEvaluationsPage()).rejects.toThrow("REDIRECT_NO_ACCESS");
    expect(mockRequireRole).toHaveBeenCalledWith(["admin"]);
  });

  it("renders empty state when no evaluations have been submitted", async () => {
    mockRequireRole.mockResolvedValueOnce({
      userId: "u1",
      role: "admin" as Role,
      courseIds: [],
    });
    results.evaluations = [];
    const page = await AdminEvaluationsPage();
    expect(page).toBeDefined();
  });
});

describe("reopenEvaluation action", () => {
  beforeEach(() => {
    mockRpcChanged.mockReset();
    authorize.mockReset();
    authorize.mockResolvedValue({
      ok: true,
      data: {
        userId: "u1",
        clerkId: "clerk-1",
        role: "admin",
        studentId: null,
        courseIds: [],
        companyId: null,
        isCompanyOwner: false,
        hasConsent: true,
      },
    });
  });

  it("reopens evaluation successfully with valid reason", async () => {
    mockRpcChanged.mockResolvedValueOnce({ ok: true, data: null });

    const result = await reopenEvaluation({
      evaluationId,
      reason: "Supervisor rated the wrong student.",
    });

    expect(result.ok).toBe(true);
    expect(mockRpcChanged).toHaveBeenCalledWith(
      "u1",
      evaluationId,
      "Supervisor rated the wrong student.",
    );
  });

  it("fails when reason is blank", async () => {
    const result = await reopenEvaluation({
      evaluationId,
      reason: "   ",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("fails when evaluationId is not a valid uuid", async () => {
    const result = await reopenEvaluation({
      evaluationId: "not-a-uuid",
      reason: "Valid reason",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
    }
  });
});
