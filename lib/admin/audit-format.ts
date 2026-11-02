// Turns an audit row into words for the Admin screens. Pure, so it is tested
// without a database.

export type AuditLike = {
  table: string;
  action: "insert" | "update" | "delete";
  subject: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
};

const tableLabels: Record<string, string> = {
  departments: "Department",
  courses: "Course",
  ojt_batches: "OJT batch",
  companies: "Company",
  listings: "Listing",
  supervisor_memberships: "Supervisor membership",
  coordinator_assignments: "Coordinator assignment",
  invitations: "Invitation",
  students: "Student",
  users: "Account",
  school_settings: "School settings",
  deployments: "Deployment",
  daily_logs: "Daily log",
};

const actionLabels = { insert: "Created", update: "Changed", delete: "Deleted" } as const;

export function tableLabel(table: string): string {
  return tableLabels[table] ?? table;
}

export function auditTables(): { value: string; label: string }[] {
  return Object.entries(tableLabels).map(([value, label]) => ({ value, label }));
}

export function actionLabel(action: AuditLike["action"]): string {
  return actionLabels[action];
}

export function fieldLabel(field: string): string {
  const spaced = field.replace(/_id$/, "").replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "empty";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}

// The record's name, from the lookup or, if it was deleted, the stored values.
export function subjectOf(entry: AuditLike): string {
  if (entry.subject) return entry.subject;
  const stored = entry.newValue ?? entry.oldValue;
  if (stored) {
    for (const key of ["name", "full_name", "email", "code", "school_year"]) {
      const value = stored[key];
      if (typeof value === "string" && value) return value;
    }
  }
  return "a record";
}

export type ChangeLine = { field: string; from: string | null; to: string | null };

// What changed, one line per field. An insert lists the new values and a
// delete the old ones; an update lists old and new side by side.
export function changeLines(entry: AuditLike): ChangeLine[] {
  const keys = Object.keys(entry.newValue ?? entry.oldValue ?? {});
  return keys
    .filter((key) => key !== "id" && key !== "created_at")
    .map((key) => ({
      field: fieldLabel(key),
      from: entry.action === "insert" ? null : formatValue(entry.oldValue?.[key]),
      to: entry.action === "delete" ? null : formatValue(entry.newValue?.[key]),
    }));
}

// One sentence for a table row, for example "Changed Company Acme Corp: Status".
export function summarize(entry: AuditLike): string {
  const base = `${actionLabel(entry.action)} ${tableLabel(entry.table).toLowerCase()} ${subjectOf(entry)}`;
  if (entry.action !== "update") return base;
  const fields = changeLines(entry).map((line) => line.field.toLowerCase());
  return fields.length ? `${base} (${fields.join(", ")})` : base;
}
