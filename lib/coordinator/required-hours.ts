import { z } from "zod";
import type { DashboardStudent } from "@/lib/coordinator/types";

// The coordinator's "Edit required hours" form (ticket-32): the input rule,
// shared by the form and the server action, and the summary the form shows
// before saving, so a typo like 40 instead of 400 is visible first.

export const maxRequiredHours = 2000;
// Above this the coordinator ticks a box to confirm the number.
export const confirmAboveHours = 1000;

const reload = "The form is out of date, so reload the page and try again.";

export const coordinatorHoursSchema = z
  .object(
    {
      batchId: z.string(reload).uuid(reload),
      requiredHours: z
        .string("Enter hours as a number, for example 486.")
        .trim()
        .min(1, "Enter the required hours, for example 486.")
        .refine((value) => /^\d{1,4}(\.\d{1,2})?$/.test(value), {
          message: "Enter hours as a number, for example 486.",
        })
        .refine((value) => Number(value) > 0, {
          message: "Required hours must be more than zero, so enter a number like 486.",
        })
        .refine((value) => Number(value) <= maxRequiredHours, {
          message: `Required hours can be at most ${maxRequiredHours}, so enter a smaller number.`,
        }),
      confirmLarge: z.boolean(reload),
    },
    reload,
  )
  .refine((value) => Number(value.requiredHours) <= confirmAboveHours || value.confirmLarge, {
    message: `Tick the box to confirm more than ${confirmAboveHours} hours.`,
    path: ["confirmLarge"],
  });

export type CoordinatorHoursInput = z.infer<typeof coordinatorHoursSchema>;

export type ReadinessChange = {
  // Active students below the current required hours who reach the new value.
  becomeReady: number;
  // Students ready for evaluation now who fall below the new value.
  stopReady: number;
  // Students whose evaluation is already submitted. Their evaluation and
  // certificate stay as they are (plan.md, open decisions).
  evaluated: number;
};

// Only a student with an active deployment can be ready for evaluation (see
// studentStatus), so only those move between "active" and "ready".
export function readinessChange(
  students: readonly Pick<DashboardStudent, "status" | "approvedHours">[],
  current: number,
  next: number,
): ReadinessChange {
  const change: ReadinessChange = { becomeReady: 0, stopReady: 0, evaluated: 0 };
  for (const student of students) {
    if (student.status === "completed") {
      change.evaluated += 1;
      continue;
    }
    if (student.status !== "active" && student.status !== "ready") continue;
    const readyNow = student.approvedHours >= current;
    const readyNext = student.approvedHours >= next;
    if (!readyNow && readyNext) change.becomeReady += 1;
    if (readyNow && !readyNext) change.stopReady += 1;
  }
  return change;
}

function students(count: number): string {
  return count === 1 ? "1 student" : `${count} students`;
}

export type SummaryLine = { tone: "teal" | "warning" | "neutral"; text: string };

// The sentences the form shows for a new value.
export function readinessSummary(change: ReadinessChange, next: number): SummaryLine[] {
  const lines: SummaryLine[] = [];
  if (change.becomeReady > 0) {
    lines.push({
      tone: "teal",
      text: `With ${next} hours, ${students(change.becomeReady)} ${change.becomeReady === 1 ? "becomes" : "become"} ready for evaluation.`,
    });
  }
  if (change.stopReady > 0) {
    lines.push({
      tone: "warning",
      text: `With ${next} hours, ${students(change.stopReady)} ${change.stopReady === 1 ? "stops" : "stop"} being ready for evaluation, and their supervisor cannot evaluate them until they reach it.`,
    });
  }
  if (lines.length === 0) {
    lines.push({ tone: "neutral", text: `With ${next} hours, no student changes stage.` });
  }
  if (change.evaluated > 0) {
    lines.push({
      tone: "neutral",
      text:
        change.evaluated === 1
          ? "1 student already has a submitted evaluation, which stays as it is."
          : `${change.evaluated} students already have a submitted evaluation, which stay as they are.`,
    });
  }
  return lines;
}
