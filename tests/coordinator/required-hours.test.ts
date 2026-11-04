import { describe, expect, it } from "vitest";
import {
  coordinatorHoursSchema,
  readinessChange,
  readinessSummary,
} from "@/lib/coordinator/required-hours";
import type { StudentStatus } from "@/lib/coordinator/types";

// The coordinator's required-hours form: which values it accepts, and the
// summary it shows before saving (ticket-32).

const batchId = "00000000-0000-4000-8000-0000000000b1";

function parse(requiredHours: string, confirmLarge = false) {
  return coordinatorHoursSchema.safeParse({ batchId, requiredHours, confirmLarge });
}

function firstError(requiredHours: string, confirmLarge = false) {
  const result = parse(requiredHours, confirmLarge);
  return result.success ? null : result.error.issues[0]?.message;
}

describe("coordinatorHoursSchema", () => {
  it("accepts whole and decimal hours from 1 to 1000 without a confirmation", () => {
    for (const value of ["1", "486", "486.5", "1000", " 300 "]) {
      expect(parse(value).success).toBe(true);
    }
  });

  it("refuses an empty value", () => {
    expect(firstError("")).toBe("Enter the required hours, for example 486.");
  });

  it("refuses zero", () => {
    expect(firstError("0")).toBe("Required hours must be more than zero, so enter a number like 486.");
  });

  it.each(["-5", "lots", "4e2", "12.345", "1,000"])("refuses %s as not a number", (value) => {
    expect(firstError(value)).toBe("Enter hours as a number, for example 486.");
  });

  it("refuses more than 2000 hours", () => {
    expect(firstError("2000.01", true)).toBe(
      "Required hours can be at most 2000, so enter a smaller number.",
    );
    expect(firstError("2500", true)).toBe(
      "Required hours can be at most 2000, so enter a smaller number.",
    );
  });

  it("asks to confirm more than 1000 hours", () => {
    expect(firstError("1200")).toBe("Tick the box to confirm more than 1000 hours.");
    expect(parse("1200", true).success).toBe(true);
    expect(parse("2000", true).success).toBe(true);
  });

  it("refuses a bad batch id", () => {
    const result = coordinatorHoursSchema.safeParse({ batchId: "nope", requiredHours: "486", confirmLarge: false });
    expect(result.success).toBe(false);
  });

  it("gives each refusal as one sentence with no prefix", () => {
    for (const value of ["", "0", "lots", "2500", "1200"]) {
      const message = firstError(value) ?? "";
      expect(message).toMatch(/^[A-Z][^.]*\.$/);
      expect(message).not.toMatch(/error|please|successfully/i);
    }
  });
});

const student = (status: StudentStatus, approvedHours: number) => ({ status, approvedHours });

describe("readinessChange", () => {
  // Required hours are 486 now.
  const students = [
    student("active", 100),
    student("active", 399.99),
    student("active", 400),
    student("ready", 486),
    student("ready", 500),
    student("completed", 490),
    student("applying", 0),
    student("no-application", 0),
    student("ended", 450),
  ];

  it("counts active students who reach a lowered value, exactly at it included", () => {
    expect(readinessChange(students, 486, 400)).toEqual({ becomeReady: 1, stopReady: 0, evaluated: 1 });
    expect(readinessChange(students, 486, 399.99)).toEqual({ becomeReady: 2, stopReady: 0, evaluated: 1 });
  });

  it("counts ready students who fall below a raised value, exactly at it excluded", () => {
    expect(readinessChange(students, 486, 500)).toEqual({ becomeReady: 0, stopReady: 1, evaluated: 1 });
    expect(readinessChange(students, 486, 500.01)).toEqual({ becomeReady: 0, stopReady: 2, evaluated: 1 });
  });

  it("does not move anyone when the value is unchanged", () => {
    expect(readinessChange(students, 486, 486)).toEqual({ becomeReady: 0, stopReady: 0, evaluated: 1 });
  });

  it("never counts students without an active deployment", () => {
    const others = [student("ended", 500), student("applying", 0), student("no-application", 0)];
    expect(readinessChange(others, 600, 100)).toEqual({ becomeReady: 0, stopReady: 0, evaluated: 0 });
  });
});

describe("readinessSummary", () => {
  it("says how many become ready", () => {
    expect(readinessSummary({ becomeReady: 32, stopReady: 0, evaluated: 0 }, 40)).toEqual([
      { tone: "teal", text: "With 40 hours, 32 students become ready for evaluation." },
    ]);
    expect(readinessSummary({ becomeReady: 1, stopReady: 0, evaluated: 0 }, 400)[0].text).toBe(
      "With 400 hours, 1 student becomes ready for evaluation.",
    );
  });

  it("warns how many stop being ready", () => {
    expect(readinessSummary({ becomeReady: 0, stopReady: 2, evaluated: 0 }, 600)).toEqual([
      {
        tone: "warning",
        text: "With 600 hours, 2 students stop being ready for evaluation, and their supervisor cannot evaluate them until they reach it.",
      },
    ]);
  });

  it("says when no student changes stage", () => {
    expect(readinessSummary({ becomeReady: 0, stopReady: 0, evaluated: 0 }, 500)).toEqual([
      { tone: "neutral", text: "With 500 hours, no student changes stage." },
    ]);
  });

  it("notes students with a submitted evaluation, which stay as they are", () => {
    const lines = readinessSummary({ becomeReady: 0, stopReady: 1, evaluated: 3 }, 500);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toEqual({
      tone: "neutral",
      text: "3 students already have a submitted evaluation, which stay as they are.",
    });
    expect(readinessSummary({ becomeReady: 0, stopReady: 0, evaluated: 1 }, 500)[1].text).toBe(
      "1 student already has a submitted evaluation, which stays as it is.",
    );
  });
});
