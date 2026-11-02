"use client";

import { useState } from "react";
import { saveTemplateAction } from "@/app/(app)/coordinator/certifications/actions";
import { FormField, FormMessage, SubmitRow, useAction } from "@/components/admin/form-parts";
import { Input } from "@/components/ui/input";
import { maxSignatoryLength } from "@/lib/certification/schemas";
import type { CertificateTemplate } from "@/lib/certification/types";

// The two signatories printed at the bottom of every certificate of a course.
// They start as the placeholders "Person 1" and "Person 2" until the school
// names the real ones. A certificate keeps the names it was made with, so a
// change here applies to certifications made from now on.

export function SignatoryForm({ template }: { template: CertificateTemplate }) {
  const { pending, message, run } = useAction();
  const [first, second] = template.signatories;
  const [values, setValues] = useState({
    signatory1Name: first.name,
    signatory1Title: first.title,
    signatory2Name: second.name,
    signatory2Title: second.title,
  });
  const [notice, setNotice] = useState<string | null>(null);
  const placeholders = [first.name, second.name].some((name) => /^Person [12]$/.test(name));
  const id = `signatories-${template.courseId}`;

  function field(key: keyof typeof values, label: string) {
    return (
      <FormField id={`${id}-${key}`} label={label}>
        <Input
          id={`${id}-${key}`}
          value={values[key]}
          maxLength={maxSignatoryLength}
          onChange={(event) => {
            setNotice(null);
            setValues((current) => ({ ...current, [key]: event.target.value }));
          }}
        />
      </FormField>
    );
  }

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        setNotice(null);
        run(
          () => saveTemplateAction({ courseId: template.courseId, ...values }),
          () => setNotice("Signatories saved. New certifications use them."),
        );
      }}
    >
      {placeholders ? (
        <p className="rounded-lg border border-warning-border bg-warning-tint px-3 py-2 text-sm text-warning-text">
          The certificate still shows a placeholder name. Replace it with the real signatory before the
          pilot starts.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("signatory1Name", "First signatory, name")}
        {field("signatory2Name", "Second signatory, name")}
        {field("signatory1Title", "First signatory, title")}
        {field("signatory2Title", "Second signatory, title")}
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
      <SubmitRow label="Save signatories" pendingLabel="Saving signatories" pending={pending} />
    </form>
  );
}
