"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileText, Upload } from "lucide-react";
import { getResumeLink, uploadResume } from "@/app/(app)/student/resume/actions";
import { FormField, FormMessage } from "@/components/admin/form-parts";
import { RoleBadge } from "@/components/coordinator/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ResumeRecord } from "@/lib/resume/queries";

// The student's resume: shows the current file, opens it through a short-lived
// link, and uploads or replaces it. The browser only gives a first quick check
// (PDF, 2 MB); the server checks the file again and decides.
const unexpected = "Something went wrong. Try again in a moment.";
const maxBytes = 2 * 1024 * 1024;

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(iso));
}

export function ResumeUploader({
  studentId,
  current,
}: {
  studentId: string;
  current: ResumeRecord | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(chosen: File | null) {
    setMessage(null);
    setNotice(null);
    setFile(null);
    setFileError(null);
    if (!chosen) return;
    if (!/\.pdf$/i.test(chosen.name) || chosen.type !== "application/pdf") {
      setFileError("Only PDF files are accepted.");
      return;
    }
    if (chosen.size > maxBytes) {
      setFileError("The file is larger than 2 MB. Upload a smaller PDF.");
      return;
    }
    setFile(chosen);
  }

  function upload() {
    if (!file) return;
    setMessage(null);
    setNotice(null);
    const form = new FormData();
    form.set("file", file);
    startTransition(async () => {
      try {
        const result = await uploadResume(form);
        if (!result.ok) {
          setMessage(result.error.message);
          return;
        }
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
        setNotice("Resume saved.");
        router.refresh();
      } catch {
        setMessage(unexpected);
      }
    });
  }

  function open() {
    setMessage(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await getResumeLink({ studentId });
        if (!result.ok) {
          setMessage(result.error.message);
          return;
        }
        window.open(result.data, "_blank", "noopener,noreferrer");
      } catch {
        setMessage(unexpected);
      }
    });
  }

  return (
    <div className="grid gap-6">
      <section aria-labelledby="current-resume" className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="current-resume" className="text-sm font-semibold text-ink">
            Current resume
          </h2>
          <RoleBadge role={current ? "success" : "neutral"}>
            {current ? "Uploaded" : "Not uploaded"}
          </RoleBadge>
        </div>
        {current ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
            <FileText
              aria-hidden="true"
              className="size-5 shrink-0 text-muted-foreground"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">resume.pdf</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatSize(current.sizeBytes)} · uploaded{" "}
                {formatDate(current.uploadedAt)}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={open}
            >
              <ExternalLink aria-hidden="true" className="size-4" />
              Open resume
            </Button>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border-strong p-4 text-sm text-muted-foreground">
            You have not uploaded a resume yet. Upload one to apply to listings.
          </p>
        )}
      </section>

      <section aria-labelledby="upload-resume" className="grid gap-4">
        <h2 id="upload-resume" className="text-sm font-semibold text-ink">
          {current ? "Replace resume" : "Upload resume"}
        </h2>
        <FormField
          id="resume-file"
          label="PDF file"
          hint="PDF only, up to 2 MB."
          error={fileError ?? undefined}
        >
          <Input
            ref={inputRef}
            id="resume-file"
            type="file"
            accept="application/pdf,.pdf"
            disabled={pending}
            aria-invalid={fileError ? true : undefined}
            aria-describedby={fileError ? "resume-file-error" : undefined}
            onChange={(event) => choose(event.target.files?.[0] ?? null)}
          />
        </FormField>
        <FormMessage message={message} />
        {notice ? (
          <p
            role="status"
            className="rounded-lg border border-success-border bg-success-tint px-3 py-2 text-sm text-success-text"
          >
            {notice}
          </p>
        ) : null}
        <div>
          <Button type="button" disabled={!file || pending} onClick={upload}>
            <Upload aria-hidden="true" className="size-4" />
            {current ? "Replace resume" : "Upload resume"}
          </Button>
        </div>
      </section>
    </div>
  );
}
