import { describe, expect, it } from "vitest";
import { sentenceFor, type AuditRowLike, type SentenceContext } from "@/lib/coordinator/audit-sentences";
import { parseAuditFilters, auditFiltersHref } from "@/lib/coordinator/audit-filters";

const context: SentenceContext = {
  batchId: "b1",
  deployments: new Map([["d1", { studentId: "s1", studentName: "DELA CRUZ, JUAN", companyName: "Northwind" }]]),
  students: new Map([["s1", "DELA CRUZ, JUAN"]]),
  actorName: "Reyes, Ana",
};

function row(over: Partial<AuditRowLike>): AuditRowLike {
  return { table_name: "daily_logs", row_id: "l1", action: "update", old_value: null, new_value: null, ...over };
}

const log = (over: Record<string, unknown>) => ({
  deployment_id: "d1",
  log_date: "2026-11-02",
  status: "pending",
  correction_reason: null,
  journal: "SECRET JOURNAL TEXT",
  ...over,
});

describe("daily log decisions", () => {
  it("says who approved an entry", () => {
    const sentence = sentenceFor(
      row({ old_value: log({ status: "pending" }), new_value: log({ status: "approved" }) }),
      context,
    );
    expect(sentence).toEqual({
      kind: "entries",
      studentId: "s1",
      text: "Reyes, Ana approved DELA CRUZ, JUAN's entry of Mon, Nov 2.",
    });
  });

  it("says rejected, and reopened (approved back to pending)", () => {
    expect(
      sentenceFor(row({ old_value: log({ status: "pending" }), new_value: log({ status: "rejected" }) }), context)?.text,
    ).toContain("rejected");
    expect(
      sentenceFor(row({ old_value: log({ status: "approved" }), new_value: log({ status: "pending" }) }), context)?.text,
    ).toContain("reopened");
  });

  it("says corrected when a correction reason is newly set", () => {
    const sentence = sentenceFor(
      row({ old_value: log({}), new_value: log({ correction_reason: "Forgot to time out" }) }),
      context,
    );
    expect(sentence?.text).toContain("corrected");
  });

  it("says added when the supervisor created the entry", () => {
    const sentence = sentenceFor(
      row({ action: "insert", new_value: log({ status: "approved", added_by: "u1" }) }),
      context,
    );
    expect(sentence?.text).toContain("added");
  });

  it("skips a student timing in, and a journal being saved", () => {
    expect(sentenceFor(row({ action: "insert", new_value: log({ status: "open" }) }), context)).toBeNull();
    expect(
      sentenceFor(row({ old_value: log({}), new_value: log({ journal: "more words" }) }), context),
    ).toBeNull();
  });

  it("skips an entry of a deployment outside the batch", () => {
    expect(
      sentenceFor(
        row({ old_value: log({ deployment_id: "other" }), new_value: log({ deployment_id: "other", status: "approved" }) }),
        context,
      ),
    ).toBeNull();
  });

  it("never carries the journal or a reason into the sentence", () => {
    const sentence = sentenceFor(
      row({ old_value: log({}), new_value: log({ status: "approved", correction_reason: "PRIVATE REASON" }) }),
      context,
    );
    expect(sentence?.text).not.toContain("SECRET");
    expect(sentence?.text).not.toContain("PRIVATE");
  });
});

describe("evaluations, certifications, placements, hours, roster", () => {
  it("evaluations: submitted and reopened, without the comments", () => {
    const submitted = sentenceFor(
      row({ table_name: "evaluations", action: "insert", new_value: { deployment_id: "d1", overall_comment: "SECRET" } }),
      context,
    );
    expect(submitted).toEqual({
      kind: "evaluations",
      studentId: "s1",
      text: "Reyes, Ana submitted the evaluation of DELA CRUZ, JUAN.",
    });
    const reopened = sentenceFor(
      row({ table_name: "evaluations", action: "delete", old_value: { deployment_id: "d1", overall_comment: "SECRET" } }),
      context,
    );
    expect(reopened?.text).toBe("Reyes, Ana reopened the evaluation of DELA CRUZ, JUAN.");
  });

  it("certifications: issued and voided", () => {
    expect(
      sentenceFor(row({ table_name: "certifications", action: "insert", new_value: { deployment_id: "d1" } }), context)?.text,
    ).toBe("A certification was issued to DELA CRUZ, JUAN.");
    expect(
      sentenceFor(
        row({
          table_name: "certifications",
          old_value: { deployment_id: "d1", status: "issued" },
          new_value: { deployment_id: "d1", status: "voided" },
        }),
        context,
      )?.text,
    ).toBe("The certification of DELA CRUZ, JUAN was voided.");
  });

  it("placements: started, and a status change", () => {
    expect(sentenceFor(row({ table_name: "deployments", row_id: "d1", action: "insert", new_value: {} }), context)?.text).toBe(
      "DELA CRUZ, JUAN started at Northwind.",
    );
    expect(
      sentenceFor(
        row({ table_name: "deployments", row_id: "d1", old_value: { status: "active" }, new_value: { status: "completed" } }),
        context,
      )?.text,
    ).toBe("The placement of DELA CRUZ, JUAN at Northwind is now completed.");
    expect(
      sentenceFor(
        row({ table_name: "deployments", row_id: "d1", old_value: { status: "active" }, new_value: { status: "active" } }),
        context,
      ),
    ).toBeNull();
    expect(sentenceFor(row({ table_name: "deployments", row_id: "elsewhere", action: "insert" }), context)).toBeNull();
  });

  it("required hours: only a real change of this batch", () => {
    expect(
      sentenceFor(
        row({ table_name: "ojt_batches", row_id: "b1", old_value: { required_hours: "300.00" }, new_value: { required_hours: "486.00" } }),
        context,
      )?.text,
    ).toBe("Reyes, Ana changed the required hours from 300 to 486.");
    expect(
      sentenceFor(
        row({ table_name: "ojt_batches", row_id: "b1", old_value: { required_hours: "300.00" }, new_value: { required_hours: "300" } }),
        context,
      ),
    ).toBeNull();
    expect(
      sentenceFor(
        row({ table_name: "ojt_batches", row_id: "other", old_value: { required_hours: 1 }, new_value: { required_hours: 2 } }),
        context,
      ),
    ).toBeNull();
  });

  it("roster: a student added to this batch only", () => {
    expect(
      sentenceFor(row({ table_name: "students", row_id: "s1", action: "insert", new_value: { ojt_batch_id: "b1" } }), context)?.text,
    ).toBe("DELA CRUZ, JUAN was added to the roster.");
    expect(
      sentenceFor(row({ table_name: "students", row_id: "s9", action: "insert", new_value: { ojt_batch_id: "other", full_name: "X" } }), context),
    ).toBeNull();
  });

  it("ignores tables the coordinator does not read here", () => {
    expect(sentenceFor(row({ table_name: "companies", action: "update" }), context)).toBeNull();
    expect(sentenceFor(row({ table_name: "users", action: "update" }), context)).toBeNull();
  });
});

describe("audit filters", () => {
  const id = "00000000-0000-4000-8000-0000000000a1";

  it("defaults, and ignores bad values", () => {
    expect(parseAuditFilters({})).toEqual({ kind: "all", student: null, from: null, to: null, shown: 50 });
    expect(parseAuditFilters({ kind: "companies", student: "x", from: "nope", shown: "-5" })).toEqual({
      kind: "all", student: null, from: null, to: null, shown: 50,
    });
  });

  it("reads a valid address and builds it back", () => {
    const filters = parseAuditFilters({ kind: "entries", student: id, from: "2026-10-01", to: "2026-10-31", shown: "100" });
    expect(filters).toEqual({ kind: "entries", student: id, from: "2026-10-01", to: "2026-10-31", shown: 100 });
    expect(auditFiltersHref(filters)).toBe(
      `/coordinator/audit?kind=entries&student=${id}&from=2026-10-01&to=2026-10-31&shown=100`,
    );
    expect(auditFiltersHref(parseAuditFilters({}))).toBe("/coordinator/audit");
  });
});
