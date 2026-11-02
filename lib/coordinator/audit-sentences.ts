import type { AuditKind } from "@/lib/coordinator/audit-filters";
import { formatLogDate } from "@/lib/logs/logic";

// Turns a raw audit row into one plain sentence for the coordinator, or nothing
// when the row is not something the coordinator needs to read (a journal being
// saved, a column touched by a trigger). Pure, so it is tested without a
// database. It only ever reads ids, statuses, dates, and numbers: never a journal,
// a comment, or a reason, so personal text cannot leak into the history.

export type AuditRowLike = {
  table_name: string;
  row_id: string;
  action: "insert" | "update" | "delete";
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
};

export type SentenceContext = {
  batchId: string;
  // deployment id to the student and company it belongs to, for this batch only.
  deployments: ReadonlyMap<string, { studentId: string; studentName: string; companyName: string | null }>;
  // student id to name, for this batch only.
  students: ReadonlyMap<string, string>;
  actorName: string;
};

export type Sentence = { kind: Exclude<AuditKind, "all">; studentId: string | null; text: string };

function str(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function num(value: unknown): number | null {
  const parsed = Number(value);
  return value === null || value === undefined || value === "" || Number.isNaN(parsed) ? null : parsed;
}

export function sentenceFor(row: AuditRowLike, context: SentenceContext): Sentence | null {
  const next = row.new_value;
  const prev = row.old_value;
  const actor = context.actorName;

  switch (row.table_name) {
    case "daily_logs": {
      const deploymentId = str(next?.deployment_id) ?? str(prev?.deployment_id);
      const deployment = deploymentId ? context.deployments.get(deploymentId) : undefined;
      if (!deployment) return null;
      const date = str(next?.log_date) ?? str(prev?.log_date);
      const entry = date ? `${deployment.studentName}'s entry of ${formatLogDate(date)}` : `an entry of ${deployment.studentName}`;
      const base = { kind: "entries", studentId: deployment.studentId } as const;
      if (row.action === "insert") {
        if (str(next?.added_by) === null) return null;
        return { ...base, text: `${actor} added ${entry}.` };
      }
      if (row.action !== "update") return null;
      const from = str(prev?.status);
      const to = str(next?.status);
      if (to === "approved" && from !== "approved") return { ...base, text: `${actor} approved ${entry}.` };
      if (to === "rejected" && from !== "rejected") return { ...base, text: `${actor} rejected ${entry}.` };
      if (from === "approved" && to === "pending") return { ...base, text: `${actor} reopened ${entry}.` };
      const corrected = str(next?.correction_reason);
      if (corrected !== null && corrected !== str(prev?.correction_reason)) {
        return { ...base, text: `${actor} corrected ${entry}.` };
      }
      return null;
    }
    case "evaluations": {
      const deploymentId = str(next?.deployment_id) ?? str(prev?.deployment_id);
      const deployment = deploymentId ? context.deployments.get(deploymentId) : undefined;
      if (!deployment) return null;
      const base = { kind: "evaluations", studentId: deployment.studentId } as const;
      if (row.action === "insert") {
        return { ...base, text: `${actor} submitted the evaluation of ${deployment.studentName}.` };
      }
      if (row.action === "delete") {
        return { ...base, text: `${actor} reopened the evaluation of ${deployment.studentName}.` };
      }
      return null;
    }
    case "certifications": {
      const deploymentId = str(next?.deployment_id) ?? str(prev?.deployment_id);
      const deployment = deploymentId ? context.deployments.get(deploymentId) : undefined;
      if (!deployment) return null;
      const base = { kind: "certifications", studentId: deployment.studentId } as const;
      if (row.action === "insert") {
        return { ...base, text: `A certification was issued to ${deployment.studentName}.` };
      }
      if (row.action === "update" && str(next?.status) === "voided" && str(prev?.status) !== "voided") {
        return { ...base, text: `The certification of ${deployment.studentName} was voided.` };
      }
      return null;
    }
    case "deployments": {
      const deployment = context.deployments.get(row.row_id);
      if (!deployment) return null;
      const base = { kind: "placements", studentId: deployment.studentId } as const;
      const at = deployment.companyName ? ` at ${deployment.companyName}` : "";
      if (row.action === "insert") {
        return { ...base, text: `${deployment.studentName} started${at || " a placement"}.` };
      }
      const from = str(prev?.status);
      const to = str(next?.status);
      if (row.action === "update" && to && from !== to) {
        const words: Record<string, string> = {
          active: "active again",
          completed: "completed",
          ended: "ended",
        };
        return { ...base, text: `The placement of ${deployment.studentName}${at} is now ${words[to] ?? to}.` };
      }
      return null;
    }
    case "ojt_batches": {
      if (row.row_id !== context.batchId || row.action !== "update") return null;
      const from = num(prev?.required_hours);
      const to = num(next?.required_hours);
      if (from === null || to === null || from === to) return null;
      return { kind: "hours", studentId: null, text: `${actor} changed the required hours from ${from} to ${to}.` };
    }
    case "students": {
      if (row.action !== "insert" || str(next?.ojt_batch_id) !== context.batchId) return null;
      const name = context.students.get(row.row_id) ?? str(next?.full_name);
      if (!name) return null;
      return { kind: "roster", studentId: row.row_id, text: `${name} was added to the roster.` };
    }
    default:
      return null;
  }
}
