"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  FormField,
  FormMessage,
  FormSheet,
  SubmitRow,
  useAction,
} from "@/components/admin/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  inviteColleagueAction,
  resendColleagueInvitationAction,
  revokeColleagueInvitationAction,
} from "@/app/(app)/supervisor/team/actions";
import { inviteColleagueSchema, type InviteColleagueInput } from "@/lib/supervisor/team";

// The owner's controls on the Team screen (ticket-33). Only the owner's page
// renders them, and the actions refuse everyone else on the server.

export function InviteColleagueSheet({ companyName }: { companyName: string }) {
  return (
    <FormSheet
      trigger="Invite supervisor"
      title="Invite supervisor"
      description={`They get an email to join ${companyName} on Dugtong. The link works for 7 days.`}
    >
      {(close) => <InviteForm onDone={close} />}
    </FormSheet>
  );
}

function InviteForm({ onDone }: { onDone: () => void }) {
  const { register, handleSubmit, formState } = useForm<InviteColleagueInput>({
    resolver: zodResolver(inviteColleagueSchema),
    defaultValues: { email: "" },
  });
  const action = useAction();
  const { errors } = formState;
  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={handleSubmit((values) => action.run(() => inviteColleagueAction(values), onDone))}
    >
      <FormField id="colleague-email" label="Email address" error={errors.email?.message}>
        <Input
          id="colleague-email"
          type="email"
          autoComplete="off"
          className="pointer-coarse:h-11"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "colleague-email-error" : undefined}
          {...register("email")}
        />
      </FormField>
      <FormMessage message={action.message} />
      <SubmitRow label="Send invitation" pendingLabel="Sending invitation" pending={action.pending} />
    </form>
  );
}

export function InvitationActions({ invitationId, email }: { invitationId: string; email: string }) {
  const resend = useAction();
  const revoke = useAction();
  const pending = resend.pending || revoke.pending;
  const message = resend.message ?? revoke.message;
  return (
    <div className="grid gap-1 sm:justify-items-end">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          aria-label={`Resend invitation to ${email}`}
          onClick={() => {
            revoke.clear();
            resend.run(() => resendColleagueInvitationAction({ invitationId }));
          }}
        >
          {resend.pending ? "Resending invitation" : "Resend invitation"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="text-error-text"
          disabled={pending}
          aria-label={`Revoke invitation to ${email}`}
          onClick={() => {
            resend.clear();
            revoke.run(() => revokeColleagueInvitationAction({ invitationId }));
          }}
        >
          {revoke.pending ? "Revoking invitation" : "Revoke invitation"}
        </Button>
      </div>
      {message ? (
        <p role="alert" className="max-w-72 text-sm text-error-text">
          {message}
        </p>
      ) : null}
    </div>
  );
}
