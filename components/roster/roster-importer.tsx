"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet } from "lucide-react";
import { commitRoster, previewRoster } from "@/app/(app)/coordinator/roster/actions";
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
import type { BatchOption, Preview } from "@/lib/roster/types";

// Step 1: choose a batch and a file. Step 2: read the preview. Step 3: commit.
// The preview writes nothing. Commit sends the same file again and the server
// checks it a second time, so what is shown here is never trusted.
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
  const [pending, startTransition] = useTransition();

  function form(): FormData {
    const data = new FormData();
    data.set("batchId", selectedBatchId);
    if (file) data.set("file", file);
    return data;
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setMessage(null);
    if (inputRef.current) inputRef.current.value = "";
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
        } else {
          setPreview(null);
          setMessage(result.error.message);
        }
      } catch {
        setMessage("Something went wrong. Try again in a moment.");
      }
    });
  }

  function runCommit() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await commitRoster(form());
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
        setMessage("Something went wrong. Try again in a moment.");
      }
    });
  }

  const shown = preview
    ? onlyProblems
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((row) => (
                    <TableRow key={row.row}>
                      <TableCell className="text-right tabular-nums">{row.row}</TableCell>
                      <TableCell>{row.fullName || "Empty"}</TableCell>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                disabled={pending || preview.withProblems > 0}
                onClick={runCommit}
              >
                {pending ? "Importing roster" : "Commit roster"}
              </Button>
              <Button type="button" variant="outline" disabled={pending} onClick={reset}>
                Choose a different file
              </Button>
              {preview.withProblems > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Fix the rows with problems in your file and preview it again. A roster is
                  imported only when every row is ready.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
