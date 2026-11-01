import { describe, expect, it } from "vitest";
import { validateRoster, type ConflictContext } from "@/lib/roster/validate";
import type { RosterRow } from "@/lib/roster/parse";

const course = "course-a";
const otherCourse = "course-b";

function context(overrides: Partial<ConflictContext> = {}): ConflictContext {
  return {
    numbersInBatch: new Set(),
    emailCourse: new Map(),
    accountEmails: new Set(),
    courseId: course,
    ...overrides,
  };
}

function row(n: number, overrides: Partial<RosterRow> = {}): RosterRow {
  return {
    row: n + 1,
    fullName: `Student ${n}`,
    studentNumber: `N-${n}`,
    email: `s${n}@example.test`,
    ...overrides,
  };
}

function problems(rows: RosterRow[], ctx = context()) {
  return validateRoster(rows, ctx).rows.map((checked) => checked.problems);
}

describe("validateRoster", () => {
  it("passes clean rows and counts them", () => {
    const result = validateRoster([row(1), row(2)], context());
    expect(result.ready).toBe(2);
    expect(result.withProblems).toBe(0);
  });

  it("trims values and lower-cases emails", () => {
    const [checked] = validateRoster(
      [row(1, { fullName: "  Ana ", studentNumber: " 1 ", email: " Ana@Example.TEST " })],
      context(),
    ).rows;
    expect(checked).toMatchObject({ fullName: "Ana", studentNumber: "1", email: "ana@example.test" });
    expect(checked.problems).toEqual([]);
  });

  it("reports a missing name, number, and email together", () => {
    expect(problems([row(1, { fullName: " ", studentNumber: "", email: "" })])).toEqual([
      ["Full name is required.", "Student number is required.", "Email is required."],
    ]);
  });

  it("rejects an email that is not valid", () => {
    expect(problems([row(1, { email: "not-an-email" }), row(2, { email: "a@b" })])).toEqual([
      ["Email is not valid."],
      ["Email is not valid."],
    ]);
  });

  it("rejects values that are too long", () => {
    const [list] = problems([
      row(1, { fullName: "x".repeat(121), studentNumber: "n".repeat(41) }),
    ]);
    expect(list).toEqual([
      "Full name is longer than 120 characters.",
      "Student number is longer than 40 characters.",
    ]);
  });

  it("flags a repeat of a student number or email, pointing at the first row", () => {
    const rows = [row(1), row(2, { studentNumber: "n-1" }), row(3, { email: "S1@example.test" })];
    expect(problems(rows)).toEqual([
      [],
      ["Student number repeats row 2."],
      ["Email repeats row 2."],
    ]);
  });

  it("flags a student number already in the batch, ignoring case", () => {
    expect(problems([row(1)], context({ numbersInBatch: new Set(["n-1"]) }))).toEqual([
      ["Student number is already in this batch."],
    ]);
  });

  it("tells apart an email on this roster, in another course, and on an account", () => {
    const ctx = context({
      emailCourse: new Map([
        ["s1@example.test", course],
        ["s2@example.test", otherCourse],
      ]),
      accountEmails: new Set(["s3@example.test"]),
    });
    expect(problems([row(1), row(2), row(3)], ctx)).toEqual([
      ["Email is already on the roster."],
      ["Email belongs to a student in another course."],
      ["An account already uses this email."],
    ]);
  });

  it("counts rows with problems", () => {
    const result = validateRoster([row(1), row(2, { email: "" }), row(3)], context());
    expect(result.ready).toBe(2);
    expect(result.withProblems).toBe(1);
  });

  it("does not let a row with a problem hide a later duplicate of its value", () => {
    const rows = [row(1, { email: "" }), row(2, { studentNumber: "N-1" })];
    expect(problems(rows)).toEqual([["Email is required."], ["Student number repeats row 2."]]);
  });
});
