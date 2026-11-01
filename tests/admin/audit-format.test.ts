import { describe, expect, it } from "vitest";
import {
  changeLines,
  fieldLabel,
  formatValue,
  subjectOf,
  summarize,
  tableLabel,
  type AuditLike,
} from "@/lib/admin/audit-format";

function entry(overrides: Partial<AuditLike>): AuditLike {
  return {
    table: "companies",
    action: "update",
    subject: "Acme Corp",
    oldValue: null,
    newValue: null,
    ...overrides,
  };
}

describe("audit wording", () => {
  it("names tables and fields in plain words", () => {
    expect(tableLabel("ojt_batches")).toBe("OJT batch");
    expect(tableLabel("something_new")).toBe("something_new");
    expect(fieldLabel("required_hours")).toBe("Required hours");
    expect(fieldLabel("company_id")).toBe("Company");
  });

  it("formats empty, boolean, and number values", () => {
    expect(formatValue(null)).toBe("empty");
    expect(formatValue("")).toBe("empty");
    expect(formatValue(true)).toBe("Yes");
    expect(formatValue(486)).toBe("486");
  });

  it("lists an update as old and new side by side", () => {
    const lines = changeLines(
      entry({ oldValue: { status: "active" }, newValue: { status: "inactive" } }),
    );
    expect(lines).toEqual([{ field: "Status", from: "active", to: "inactive" }]);
  });

  it("lists an insert as new values only, without ids", () => {
    const lines = changeLines(
      entry({
        action: "insert",
        newValue: { id: "x", name: "Acme", created_at: "now", status: "active" },
      }),
    );
    expect(lines).toEqual([
      { field: "Name", from: null, to: "Acme" },
      { field: "Status", from: null, to: "active" },
    ]);
  });

  it("lists a delete as old values only", () => {
    const lines = changeLines(entry({ action: "delete", oldValue: { name: "Acme" } }));
    expect(lines).toEqual([{ field: "Name", from: "Acme", to: null }]);
  });

  it("names a deleted record from its stored values", () => {
    expect(subjectOf(entry({ subject: null, oldValue: { name: "Gone Co" } }))).toBe("Gone Co");
    expect(subjectOf(entry({ subject: null }))).toBe("a record");
  });

  it("summarizes an update with the fields that changed", () => {
    expect(
      summarize(entry({ oldValue: { status: "active" }, newValue: { status: "inactive" } })),
    ).toBe("Changed company Acme Corp (status)");
  });

  it("summarizes a create without a field list", () => {
    expect(summarize(entry({ action: "insert", newValue: { name: "Acme" } }))).toBe(
      "Created company Acme Corp",
    );
  });
});
