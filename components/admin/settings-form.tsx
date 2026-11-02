"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FormField, FormMessage, SubmitRow, useAction } from "@/components/admin/form-parts";
import { Input } from "@/components/ui/input";
import { saveSchoolSettings } from "@/app/(app)/admin/actions";
import { schoolSettingsSchema, type SchoolSettingsInput } from "@/lib/admin/schemas";
import type { SchoolSettingsDetail } from "@/lib/admin/queries";

export function SettingsForm({
  initialSettings,
}: {
  initialSettings: SchoolSettingsDetail;
}) {
  const [savedSuccess, setSavedSuccess] = useState(false);
  const action = useAction();

  const { register, handleSubmit, formState } = useForm<SchoolSettingsInput>({
    resolver: zodResolver(schoolSettingsSchema),
    defaultValues: {
      name: initialSettings.name,
      timezone: initialSettings.timezone,
      consentNoticeVersion: initialSettings.consentNoticeVersion,
    },
  });

  const { errors } = formState;

  function onSubmit(values: SchoolSettingsInput) {
    setSavedSuccess(false);
    action.run(
      () => saveSchoolSettings(values),
      () => setSavedSuccess(true),
    );
  }

  return (
    <form noValidate className="grid max-w-xl gap-4" onSubmit={handleSubmit(onSubmit)}>
      <FormField
        id="school-name"
        label="School name"
        error={errors.name?.message}
        hint="The institution name shown on headers, DTR exports, and certifications."
      >
        <Input
          id="school-name"
          autoComplete="off"
          aria-invalid={!!errors.name}
          {...register("name")}
        />
      </FormField>

      <FormField
        id="school-timezone"
        label="Timezone"
        error={errors.timezone?.message}
        hint="Timezone used to calculate the log date and verify daily timestamps (Asia/Manila)."
      >
        <Input
          id="school-timezone"
          autoComplete="off"
          aria-invalid={!!errors.timezone}
          {...register("timezone")}
        />
      </FormField>

      <FormField
        id="school-consent"
        label="Consent notice version"
        error={errors.consentNoticeVersion?.message}
        hint="Under the Philippine Data Privacy Act of 2012, updating this version forces all users to acknowledge the revised notice upon their next sign-in."
      >
        <Input
          id="school-consent"
          autoComplete="off"
          aria-invalid={!!errors.consentNoticeVersion}
          {...register("consentNoticeVersion")}
        />
      </FormField>

      {savedSuccess ? (
        <p
          role="status"
          className="rounded-lg border border-success-border bg-success-tint px-3 py-2 text-sm text-success-text"
        >
          Settings saved.
        </p>
      ) : null}

      <FormMessage message={action.message} />

      <div className="pt-2">
        <SubmitRow
          label="Save settings"
          pendingLabel="Saving settings"
          pending={action.pending}
        />
      </div>
    </form>
  );
}
