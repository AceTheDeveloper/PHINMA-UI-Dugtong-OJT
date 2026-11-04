"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import {
  FormField,
  FormMessage,
  FormSheet,
  SubmitRow,
  useAction,
} from "@/components/admin/form-parts";
import { Input } from "@/components/ui/input";
import { changeRequiredHoursAction } from "@/app/(app)/coordinator/actions";
import {
  confirmAboveHours,
  coordinatorHoursSchema,
  maxRequiredHours,
  readinessChange,
  readinessSummary,
  type CoordinatorHoursInput,
  type SummaryLine,
} from "@/lib/coordinator/required-hours";
import type { DashboardStudent } from "@/lib/coordinator/types";
import { cn } from "@/lib/utils";

// "Edit required hours" on the coordinator dashboard (ticket-32). The form shows
// the current value and, before saving, how many students change stage.

const toneClass: Record<SummaryLine["tone"], string> = {
  teal: "border-teal-border bg-teal-tint text-teal-text",
  warning: "border-warning-border bg-warning-tint text-warning-text",
  neutral: "border-neutral-border bg-neutral-tint text-neutral-text",
};

export function RequiredHoursSheet({
  batchId,
  batchLabel,
  courseShort,
  current,
  students,
}: {
  batchId: string;
  batchLabel: string;
  courseShort: string;
  current: number;
  students: readonly Pick<DashboardStudent, "status" | "approvedHours">[];
}) {
  return (
    <FormSheet
      trigger="Edit required hours"
      title="Edit required hours"
      description={`${courseShort}, batch ${batchLabel}. The change is recorded in the audit log.`}
      variant="outline"
      showPlus={false}
    >
      {(close) => (
        <HoursForm batchId={batchId} current={current} students={students} onDone={close} />
      )}
    </FormSheet>
  );
}

// The typed value as a number when it is one the form would accept, else null.
function candidate(value: string): number | null {
  const text = value.trim();
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(text)) return null;
  const hours = Number(text);
  return hours > 0 && hours <= maxRequiredHours ? hours : null;
}

function HoursForm({
  batchId,
  current,
  students,
  onDone,
}: {
  batchId: string;
  current: number;
  students: readonly Pick<DashboardStudent, "status" | "approvedHours">[];
  onDone: () => void;
}) {
  const { register, handleSubmit, formState, control } = useForm<CoordinatorHoursInput>({
    resolver: zodResolver(coordinatorHoursSchema),
    defaultValues: { batchId, requiredHours: String(current), confirmLarge: false },
  });
  const action = useAction();
  const { errors } = formState;
  const next = candidate(useWatch({ control, name: "requiredHours" }));
  const lines =
    next === null || next === current
      ? []
      : readinessSummary(readinessChange(students, current, next), next);

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={handleSubmit((values) =>
        action.run(() => changeRequiredHoursAction(values), onDone),
      )}
    >
      <input type="hidden" {...register("batchId")} />
      <div className="flex items-baseline justify-between gap-3 border-b border-border pb-3">
        <span className="text-sm text-muted-foreground">Required hours now</span>
        <span className="font-mono text-lg font-semibold tabular-nums text-ink">{current}</span>
      </div>
      <FormField
        id="coordinator-hours"
        label="New required hours"
        error={errors.requiredHours?.message}
        hint={`From 1 to ${maxRequiredHours} hours.`}
      >
        <Input
          id="coordinator-hours"
          inputMode="decimal"
          autoComplete="off"
          className="font-mono tabular-nums pointer-coarse:h-11"
          aria-invalid={!!errors.requiredHours}
          aria-describedby={errors.requiredHours ? "coordinator-hours-error" : undefined}
          {...register("requiredHours")}
        />
      </FormField>

      {lines.length > 0 ? (
        <ul aria-live="polite" className="grid gap-2">
          {lines.map((line) => (
            <li
              key={line.text}
              className={cn("rounded-lg border px-3 py-2 text-sm tabular-nums", toneClass[line.tone])}
            >
              {line.text}
            </li>
          ))}
        </ul>
      ) : null}

      {next !== null && next > confirmAboveHours ? (
        <div className="grid gap-1.5">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
            <input
              type="checkbox"
              className="size-5 rounded border-input text-primary focus:ring-primary"
              aria-invalid={!!errors.confirmLarge}
              aria-describedby={errors.confirmLarge ? "coordinator-hours-confirm-error" : undefined}
              {...register("confirmLarge")}
            />
            <span>
              Yes, <span className="font-mono tabular-nums">{next}</span> hours is the right number.
            </span>
          </label>
          {errors.confirmLarge ? (
            <p id="coordinator-hours-confirm-error" className="text-sm text-error-text">
              {errors.confirmLarge.message}
            </p>
          ) : null}
        </div>
      ) : null}

      <FormMessage message={action.message} />
      <SubmitRow
        label="Save required hours"
        pendingLabel="Saving required hours"
        pending={action.pending}
      />
    </form>
  );
}
