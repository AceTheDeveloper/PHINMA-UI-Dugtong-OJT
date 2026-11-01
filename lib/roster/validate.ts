import type { RosterRow } from "@/lib/roster/parse";

// Row-by-row checks for the preview. Pure, so it is tested without a database.
// The database function import_roster runs the same rules again on commit; this
// copy exists to show every problem at once, in plain sentences, before that.

export const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const maxNameLength = 120;
export const maxNumberLength = 40;

// What the database already holds that a file could collide with.
export type ConflictContext = {
  // student numbers (lower-cased) already in the chosen batch
  numbersInBatch: ReadonlySet<string>;
  // lower-cased email -> course id of the student who has it
  emailCourse: ReadonlyMap<string, string>;
  // lower-cased emails of existing accounts
  accountEmails: ReadonlySet<string>;
  // the chosen batch's course
  courseId: string;
};

export type RowCheck = RosterRow & {
  email: string;
  problems: string[];
};

export type RosterCheck = {
  rows: RowCheck[];
  ready: number;
  withProblems: number;
};

export function validateRoster(rows: readonly RosterRow[], context: ConflictContext): RosterCheck {
  const firstNumberRow = new Map<string, number>();
  const firstEmailRow = new Map<string, number>();

  const checked = rows.map((source): RowCheck => {
    const fullName = source.fullName.trim();
    const studentNumber = source.studentNumber.trim();
    const email = source.email.trim().toLowerCase();
    const problems: string[] = [];

    if (fullName === "") {
      problems.push("Full name is required.");
    } else if (fullName.length > maxNameLength) {
      problems.push(`Full name is longer than ${maxNameLength} characters.`);
    }

    const numberKey = studentNumber.toLowerCase();
    if (studentNumber === "") {
      problems.push("Student number is required.");
    } else if (studentNumber.length > maxNumberLength) {
      problems.push(`Student number is longer than ${maxNumberLength} characters.`);
    } else if (firstNumberRow.has(numberKey)) {
      problems.push(`Student number repeats row ${firstNumberRow.get(numberKey)}.`);
    } else if (context.numbersInBatch.has(numberKey)) {
      problems.push("Student number is already in this batch.");
    }
    if (studentNumber !== "" && !firstNumberRow.has(numberKey)) {
      firstNumberRow.set(numberKey, source.row);
    }

    if (email === "") {
      problems.push("Email is required.");
    } else if (!emailPattern.test(email)) {
      problems.push("Email is not valid.");
    } else if (firstEmailRow.has(email)) {
      problems.push(`Email repeats row ${firstEmailRow.get(email)}.`);
    } else {
      const course = context.emailCourse.get(email);
      if (course !== undefined && course !== context.courseId) {
        problems.push("Email belongs to a student in another course.");
      } else if (course !== undefined) {
        problems.push("Email is already on the roster.");
      } else if (context.accountEmails.has(email)) {
        problems.push("An account already uses this email.");
      }
    }
    if (email !== "" && !firstEmailRow.has(email)) {
      firstEmailRow.set(email, source.row);
    }

    return { row: source.row, fullName, studentNumber, email, problems };
  });

  const withProblems = checked.filter((row) => row.problems.length > 0).length;
  return { rows: checked, ready: checked.length - withProblems, withProblems };
}
