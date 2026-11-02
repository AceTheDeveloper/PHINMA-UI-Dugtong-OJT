"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { AlertCircle, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { FormField, FormMessage, SubmitRow, useAction } from "@/components/admin/form-parts";
import { reopenEvaluation } from "@/app/(app)/admin/actions";
import { reopenEvaluationSchema, type ReopenEvaluationInput } from "@/lib/admin/schemas";

export function ReopenEvaluationDialog({
  evaluationId,
  studentName,
  onSuccess,
}: {
  evaluationId: string;
  studentName: string;
  onSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const action = useAction();

  const { register, handleSubmit, formState, reset } = useForm<ReopenEvaluationInput>({
    resolver: zodResolver(reopenEvaluationSchema),
    defaultValues: {
      evaluationId,
      reason: "",
    },
  });

  const { errors } = formState;

  function onSubmit(values: ReopenEvaluationInput) {
    action.run(
      () => reopenEvaluation(values),
      () => {
        setOpen(false);
        reset();
        onSuccess?.();
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm" type="button">
            <LockOpen aria-hidden="true" />
            <span>Reopen evaluation</span>
          </Button>
        }
      />
      <SheetContent className="gap-0 data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="font-heading text-lg font-bold text-ink">
            Reopen evaluation (support action)
          </SheetTitle>
          <SheetDescription>
            Unlock the final evaluation for {studentName}.
          </SheetDescription>
        </SheetHeader>

        <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid flex-1 gap-4 p-4 overflow-y-auto">
          <div className="flex items-start gap-2.5 rounded-lg border border-warning-border bg-warning-tint p-3 text-sm text-warning-text">
            <AlertCircle className="size-5 shrink-0" aria-hidden="true" />
            <p>
              This will void any issued certificate, remove the evaluation scores, and return the deployment to active status so the supervisor can submit a corrected evaluation. The audit log retains the original submission history.
            </p>
          </div>

          <FormField
            id="reopen-eval-reason"
            label="Support reason or ticket reference"
            error={errors.reason?.message}
            hint="Mandatory support justification recorded in the system audit log."
          >
            <textarea
              id="reopen-eval-reason"
              rows={3}
              placeholder="e.g., Support ticket #204: Supervisor evaluated wrong student."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-invalid={!!errors.reason}
              {...register("reason")}
            />
          </FormField>

          <FormMessage message={action.message} />

          <div className="pt-2">
            <SubmitRow
              label="Reopen evaluation"
              pendingLabel="Reopening evaluation"
              pending={action.pending}
            />
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
