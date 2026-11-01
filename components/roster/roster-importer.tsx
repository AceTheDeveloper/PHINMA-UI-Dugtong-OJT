"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, FileSpreadsheet, Pencil, Trash2, Undo2, X } from "lucide-react";
import {
  commitRoster,
  previewRoster,
  recheckRoster,
} from "@/app/(app)/coordinator/roster/actions";
import { FormField, FormMessage, NativeSelect } from "@/components/admin/form-parts";
import { RoleBadge } from "@/components/coordinator/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BatchOption, Preview, PreviewRow } from "@/lib/roster/types";

// Step 1: choose a batch and a file. Step 2: read the preview, and edit or
// remove rows with problems. Step 3: commit. Nothing is written until commit.
// After every edit or removal the rows go back to the server to be checked
// again, and commit sends the rows on screen, which the server checks once
// more, so what is shown here is never trusted.
const unexpected = "Something went wrong. Try again in a moment.";

type Draft = { fullName: string; studentNumber: string; email: string };

function sendable(rows: PreviewRow[]) {
  return rows.map(({ row, fullName, studentNumber, email }) => ({
    row,
    fullName,
    studentNumber,
    email,
  }));
}
export function RosterImporter({
  batches,
  selectedBatchId,
}: {
  batches: BatchOption[];
  selectedBatchId: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [removed, setRemoved] = useState<PreviewRow[]>([]);
  const [edited, setEdited] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>({ fullName: "", studentNumber: "", email: "" });
  const [pending, startTransition] = useTransition();

  function form(): FormData {
    const data = new FormData();
    data.set("batchId", selectedBatchId);
    if (file) data.set("file", file);
    return data;
  }

  function clearWork() {
    setRemoved([]);
    setEdited(new Set());
    setEditing(null);
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setMessage(null);
    clearWork();
    if (inputRef.current) inputRef.current.value = "";
  }

  // Applies a change to the working rows, then has the server check them again
  // (a fix or a removal can clear a problem on another row).
  function change(rows: PreviewRow[], nextRemoved: PreviewRow[], nextEdited: Set<number>) {
    if (!preview) return;
    setMessage(null);
    const settle = (next: Preview) => {
      setPreview(next);
      setRemoved(nextRemoved);
      setEdited(nextEdited);
      setEditing(null);
    };
    if (rows.length === 0) {
      settle({ ...preview, rows: [], ready: 0, withProblems: 0 });
      return;
    }
    startTransition(async () => {
      try {
        const result = await recheckRoster({ batchId: selectedBatchId, rows: sendable(rows) });
        if (result.ok) {
          settle({ ...result.data, fileName: preview.fileName });
        } else {
          setMessage(result.error.message);
        }
      } catch {
        setMessage(unexpected);
      }
    });
  }

  function startEdit(row: PreviewRow) {
    setEditing(row.row);
    setDraft({ fullName: row.fullName, studentNumber: row.studentNumber, email: row.email });
  }

  function saveEdit(target: PreviewRow) {
    if (!preview) return;
    const next = {
      fullName: draft.fullName.trim(),
      studentNumber: draft.studentNumber.trim(),
      email: draft.email.trim(),
    };
    const changed =
      next.fullName !== target.fullName ||
      next.studentNumber !== target.studentNumber ||
      next.email !== target.email;
    if (!changed) {
      setEditing(null);
      return;
    }
    change(
      preview.rows.map((row) => (row.row === target.row ? { ...row, ...next } : row)),
      removed,
      new Set(edited).add(target.row),
    );
  }

  function removeRow(target: PreviewRow) {
    if (!preview) return;
    change(
      preview.rows.filter((row) => row.row !== target.row),
      [...removed, target].sort((a, b) => a.row - b.row),
      edited,
    );
  }

  function undoRemove(target: PreviewRow) {
    if (!preview) return;
    change(
      [...preview.rows, target].sort((a, b) => a.row - b.row),
      removed.filter((row) => row.row !== target.row),
      edited,
    );
  }

  function runPreview() {
    setMessage(null);
    setNotice(null);
    if (!file) {
      setMessage("Choose a .csv or .xlsx file first.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await previewRoster(form());
        if (result.ok) {
          setPreview(result.data);
          setOnlyProblems(false);
          clearWork();
        } else {
          setPreview(null);
          setMessage(result.error.message);
        }
      } catch {
        setMessage(unexpected);
      }
    });
  }

  function runCommit() {
    if (!preview) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await commitRoster({
          batchId: selectedBatchId,
          rows: sendable(preview.rows),
        });
        if (result.ok) {
          const count = result.data.imported;
          reset();
          setNotice(
            `Imported ${count} ${count === 1 ? "student" : "students"}. Send their invitations when you are ready.`,
          );
          router.refresh();
        } else {
          setMessage(result.error.message);
        }
      } catch {
        setMessage(unexpected);
      }
    });
  }

  // The filter only applies while there are problems to show, so fixing the
  // last one cannot leave the table empty behind a checkbox that is gone.
  const shown = preview
    ? onlyProblems && preview.withProblems > 0
      ? preview.rows.filter((row) => row.problems.length > 0)
      : preview.rows
    : [];

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2} className="font-heading text-base font-bold">
            1. Choose a batch and a file
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="roster-batch" label="OJT batch">
              <NativeSelect
                id="roster-batch"
                value={selectedBatchId}
                disabled={pending}
                onChange={(event) => {
                  reset();
                  setNotice(null);
                  router.replace(`/coordinator/roster?batch=${event.target.value}`);
                }}
              >
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              id="roster-file"
              label="Student list"
              hint="A .csv or .xlsx file in the school's list format. Only STUDENT ID, STUDENT NAME, and EMAIL are read."
            >
              <Input
                ref={inputRef}
                id="roster-file"
                type="file"
                accept=".csv,.xlsx"
                disabled={pending}
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setPreview(null);
                  clearWork();
                  setMessage(null);
                  setNotice(null);
                }}
              />
            </FormField>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" disabled={pending || !file} onClick={runPreview}>
              <FileSpreadsheet aria-hidden="true" data-icon="inline-start" />
              {pending && !preview ? "Reading file" : "Preview roster"}
            </Button>
            <a
              href="/coordinator/roster/template"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <Download aria-hidden="true" className="size-4" />
              Download template
            </a>
          </div>
          <FormMessage message={message} />
          {notice ? (
            <p
              role="status"
              className="rounded-lg border border-success-border bg-success-tint px-3 py-2 text-sm text-success-text"
            >
              {notice}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="font-heading text-base font-bold">
              2. Check the preview
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Nothing has been imported yet. File: {preview.fileName}
            </p>
            <dl className="grid gap-3 sm:grid-cols-3">
              {[
                ["Rows", preview.rows.length],
                ["Ready", preview.ready],
                ["With problems", preview.withProblems],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-border bg-surface px-4 py-3">
                  <dt className="text-sm font-semibold text-muted-foreground">{label}</dt>
                  <dd className="font-heading text-2xl font-bold tabular-nums text-ink">{value}</dd>
                </div>
              ))}
            </dl>

            {preview.withProblems > 0 ? (
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={onlyProblems}
                  onChange={(event) => setOnlyProblems(event.target.checked)}
                  className="size-4 accent-primary"
                />
                Show only rows with problems
              </label>
            ) : null}

            <div className="max-h-[32rem] overflow-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-right">Row</TableHead>
                    <TableHead>Full name</TableHead>
                    <TableHead>Student number</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((row) =>
                    editing === row.row ? (
                      <TableRow key={row.row}>
                        <TableCell className="text-right tabular-nums">{row.row}</TableCell>
                        <TableCell>
                          <Input
                            aria-label={`Full name, row ${row.row}`}
                            value={draft.fullName}
                            disabled={pending}
                            onChange={(event) => setDraft({ ...draft, fullName: event.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            aria-label={`Student number, row ${row.row}`}
                            className="font-mono tabular-nums"
                            value={draft.studentNumber}
                            disabled={pending}
                            onChange={(event) =>
                              setDraft({ ...draft, studentNumber: event.target.value })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            aria-label={`Email, row ${row.row}`}
                            type="email"
                            value={draft.email}
                            disabled={pending}
                            onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                          />
                        </TableCell>
                        <TableCell />
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="sm"
                              disabled={pending}
                              onClick={() => saveEdit(row)}
                            >
                              <Check aria-hidden="true" data-icon="inline-start" />
                              Save row
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={pending}
                              onClick={() => setEditing(null)}
                            >
                              <X aria-hidden="true" data-icon="inline-start" />
                              Cancel
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow key={row.row}>
                        <TableCell className="text-right tabular-nums">{row.row}</TableCell>
                        <TableCell>
                          {row.fullName || "Empty"}
                          {edited.has(row.row) ? (
                            <RoleBadge role="neutral" className="ml-2">
                              Edited
                            </RoleBadge>
                          ) : null}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">
                          {row.studentNumber || "Empty"}
                        </TableCell>
                        <TableCell className="break-all">{row.email || "Empty"}</TableCell>
                        <TableCell>
                          {row.problems.length === 0 ? (
                            <RoleBadge role="success">Ready</RoleBadge>
                          ) : (
                            <ul className="grid gap-1">
                              {row.problems.map((problem) => (
                                <li key={problem}>
                                  <RoleBadge role="error" className="h-auto whitespace-normal py-0.5">
                                    {problem}
                                  </RoleBadge>
                                </li>
                              ))}
                            </ul>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={pending}
                              aria-label={`Edit row ${row.row}`}
                              onClick={() => startEdit(row)}
                            >
                              <Pencil aria-hidden="true" data-icon="inline-start" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={pending}
                              aria-label={`Remove row ${row.row}`}
                              onClick={() => removeRow(row)}
                            >
                              <Trash2 aria-hidden="true" data-icon="inline-start" />
                              Remove
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ),
                  )}
                </TableBody>
              </Table>
            </div>

            {removed.length > 0 ? (
              <div className="grid gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                <p className="font-semibold text-ink tabular-nums">
                  Removed ({removed.length}). These rows will not be imported.
                </p>
                <ul className="grid gap-1">
                  {removed.map((row) => (
                    <li key={row.row} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-muted-foreground">
                        <span className="tabular-nums">Row {row.row}</span>:{" "}
                        {row.fullName || "No name"}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => undoRemove(row)}
                      >
                        <Undo2 aria-hidden="true" data-icon="inline-start" />
                        Undo
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                disabled={pending || preview.rows.length === 0 || preview.withProblems > 0}
                onClick={runCommit}
              >
                {pending ? "Importing roster" : "Commit roster"}
              </Button>
              <Button type="button" variant="outline" disabled={pending} onClick={reset}>
                Choose a different file
              </Button>
              {preview.withProblems > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Edit or remove the rows with problems. A roster is imported only when every
                  row is ready.
                </p>
              ) : null}
              {preview.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Every row was removed. Undo a removal or choose a different file.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
