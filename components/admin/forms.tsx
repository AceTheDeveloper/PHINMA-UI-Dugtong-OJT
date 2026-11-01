"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  FormField,
  FormMessage,
  FormSheet,
  NativeSelect,
  SubmitRow,
  useAction,
} from "@/components/admin/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addCompany,
  addCourse,
  addDepartment,
  addOjtBatch,
  changeCompanyStatus,
  changeRequiredHours,
  inviteAdmin,
  inviteCoordinator,
  inviteSupervisor,
  revokeInvitation,
} from "@/app/(app)/admin/actions";
import {
  batchSchema,
  companySchema,
  courseSchema,
  departmentSchema,
  inviteAdminSchema,
  inviteCoordinatorSchema,
  inviteSupervisorSchema,
  requiredHoursSchema,
  type BatchInput,
  type CompanyInput,
  type CourseInput,
  type DepartmentInput,
  type InviteAdminInput,
  type InviteCoordinatorInput,
  type InviteSupervisorInput,
  type RequiredHoursInput,
} from "@/lib/admin/schemas";

export type Option = { value: string; label: string };

// ------------------------------------------------------------------ academics

export function AddDepartmentSheet() {
  return (
    <FormSheet
      trigger="Add department"
      title="Add department"
      description="A department groups courses, for example CITE."
    >
      {(close) => <DepartmentForm onDone={close} />}
    </FormSheet>
  );
}

function DepartmentForm({ onDone }: { onDone: () => void }) {
  const { register, handleSubmit, formState } = useForm<DepartmentInput>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { code: "", name: "" },
  });
  const action = useAction();
  const { errors } = formState;
  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={handleSubmit((values) => action.run(() => addDepartment(values), onDone))}
    >
      <FormField id="dept-code" label="Code" error={errors.code?.message} hint="For example CITE.">
        <Input id="dept-code" autoComplete="off" aria-invalid={!!errors.code} {...register("code")} />
      </FormField>
      <FormField id="dept-name" label="Name" error={errors.name?.message}>
        <Input id="dept-name" autoComplete="off" aria-invalid={!!errors.name} {...register("name")} />
      </FormField>
      <FormMessage message={action.message} />
      <SubmitRow label="Add department" pendingLabel="Adding department" pending={action.pending} />
    </form>
  );
}

export function AddCourseSheet({ departments }: { departments: Option[] }) {
  return (
    <FormSheet
      trigger="Add course"
      title="Add course"
      description="A course belongs to one department, for example BSIT."
      variant="outline"
      disabled={departments.length === 0}
    >
      {(close) => <CourseForm departments={departments} onDone={close} />}
    </FormSheet>
  );
}

function CourseForm({ departments, onDone }: { departments: Option[]; onDone: () => void }) {
  const { register, handleSubmit, formState } = useForm<CourseInput>({
    resolver: zodResolver(courseSchema),
    defaultValues: { departmentId: departments[0]?.value ?? "", code: "", name: "" },
  });
  const action = useAction();
  const { errors } = formState;
  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={handleSubmit((values) => action.run(() => addCourse(values), onDone))}
    >
      <FormField id="course-dept" label="Department" error={errors.departmentId?.message}>
        <NativeSelect id="course-dept" {...register("departmentId")}>
          {departments.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField id="course-code" label="Code" error={errors.code?.message} hint="For example BSIT.">
        <Input id="course-code" autoComplete="off" aria-invalid={!!errors.code} {...register("code")} />
      </FormField>
      <FormField id="course-name" label="Name" error={errors.name?.message}>
        <Input id="course-name" autoComplete="off" aria-invalid={!!errors.name} {...register("name")} />
      </FormField>
      <FormMessage message={action.message} />
      <SubmitRow label="Add course" pendingLabel="Adding course" pending={action.pending} />
    </form>
  );
}

export function AddBatchSheet({ courses }: { courses: Option[] }) {
  return (
    <FormSheet
      trigger="Add OJT batch"
      title="Add OJT batch"
      description="A batch is one course's OJT in one school year. The required hours live here."
      variant="outline"
      disabled={courses.length === 0}
    >
      {(close) => <BatchForm courses={courses} onDone={close} />}
    </FormSheet>
  );
}

function BatchForm({ courses, onDone }: { courses: Option[]; onDone: () => void }) {
  const { register, handleSubmit, formState } = useForm<BatchInput>({
    resolver: zodResolver(batchSchema),
    defaultValues: {
      courseId: courses[0]?.value ?? "",
      schoolYear: "",
      requiredHours: "",
      startsOn: "",
      endsOn: "",
    },
  });
  const action = useAction();
  const { errors } = formState;
  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={handleSubmit((values) => action.run(() => addOjtBatch(values), onDone))}
    >
      <FormField id="batch-course" label="Course" error={errors.courseId?.message}>
        <NativeSelect id="batch-course" {...register("courseId")}>
          {courses.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField
        id="batch-year"
        label="School year"
        error={errors.schoolYear?.message}
        hint="For example 2026-2027."
      >
        <Input
          id="batch-year"
          autoComplete="off"
          className="tabular-nums"
          aria-invalid={!!errors.schoolYear}
          {...register("schoolYear")}
        />
      </FormField>
      <FormField id="batch-hours" label="Required hours" error={errors.requiredHours?.message}>
        <Input
          id="batch-hours"
          inputMode="decimal"
          autoComplete="off"
          className="tabular-nums"
          aria-invalid={!!errors.requiredHours}
          {...register("requiredHours")}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="batch-start" label="Starts on (optional)" error={errors.startsOn?.message}>
          <Input id="batch-start" type="date" className="tabular-nums" {...register("startsOn")} />
        </FormField>
        <FormField id="batch-end" label="Ends on (optional)" error={errors.endsOn?.message}>
          <Input id="batch-end" type="date" className="tabular-nums" {...register("endsOn")} />
        </FormField>
      </div>
      <FormMessage message={action.message} />
      <SubmitRow label="Add OJT batch" pendingLabel="Adding OJT batch" pending={action.pending} />
    </form>
  );
}

export function EditHoursSheet({
  batchId,
  label,
  current,
}: {
  batchId: string;
  label: string;
  current: number;
}) {
  return (
    <FormSheet
      trigger="Edit hours"
      title="Edit required hours"
      description={`${label}. The change is recorded in the audit log.`}
      variant="ghost"
      size="sm"
      showPlus={false}
    >
      {(close) => <HoursForm batchId={batchId} current={current} onDone={close} />}
    </FormSheet>
  );
}

function HoursForm({
  batchId,
  current,
  onDone,
}: {
  batchId: string;
  current: number;
  onDone: () => void;
}) {
  const { register, handleSubmit, formState } = useForm<RequiredHoursInput>({
    resolver: zodResolver(requiredHoursSchema),
    defaultValues: { batchId, requiredHours: String(current) },
  });
  const action = useAction();
  const { errors } = formState;
  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={handleSubmit((values) => action.run(() => changeRequiredHours(values), onDone))}
    >
      <input type="hidden" {...register("batchId")} />
      <FormField id="hours-value" label="Required hours" error={errors.requiredHours?.message}>
        <Input
          id="hours-value"
          inputMode="decimal"
          autoComplete="off"
          className="tabular-nums"
          aria-invalid={!!errors.requiredHours}
          {...register("requiredHours")}
        />
      </FormField>
      <FormMessage message={action.message} />
      <SubmitRow label="Save hours" pendingLabel="Saving hours" pending={action.pending} />
    </form>
  );
}

// ------------------------------------------------------------------ companies

export function AddCompanySheet() {
  return (
    <FormSheet
      trigger="Add company"
      title="Add company"
      description="Add a partner company the school provided. Invite its first supervisor afterwards."
    >
      {(close) => <CompanyForm onDone={close} />}
    </FormSheet>
  );
}

function CompanyForm({ onDone }: { onDone: () => void }) {
  const { register, handleSubmit, formState } = useForm<CompanyInput>({
    resolver: zodResolver(companySchema),
    defaultValues: { name: "", address: "" },
  });
  const action = useAction();
  const { errors } = formState;
  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={handleSubmit((values) => action.run(() => addCompany(values), onDone))}
    >
      <FormField id="company-name" label="Name" error={errors.name?.message}>
        <Input id="company-name" autoComplete="off" aria-invalid={!!errors.name} {...register("name")} />
      </FormField>
      <FormField id="company-address" label="Address (optional)" error={errors.address?.message}>
        <Input id="company-address" autoComplete="off" {...register("address")} />
      </FormField>
      <FormMessage message={action.message} />
      <SubmitRow label="Add company" pendingLabel="Adding company" pending={action.pending} />
    </form>
  );
}

export function CompanyStatusButton({
  companyId,
  status,
}: {
  companyId: string;
  status: "active" | "inactive";
}) {
  const action = useAction();
  const next = status === "active" ? "inactive" : "active";
  return (
    <div className="grid justify-items-start gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={action.pending}
        onClick={() => action.run(() => changeCompanyStatus({ companyId, status: next }))}
      >
        {status === "active" ? "Deactivate company" : "Activate company"}
      </Button>
      <FormMessage message={action.message} />
    </div>
  );
}

export function InviteSupervisorSheet({
  companyId,
  companyName,
  disabled,
  trigger = "Invite supervisor",
}: {
  companyId: string;
  companyName: string;
  disabled?: boolean;
  trigger?: string;
}) {
  return (
    <FormSheet
      trigger={trigger}
      title="Invite supervisor"
      description={`Send an invitation to join ${companyName}. The first supervisor to accept becomes the company owner.`}
      disabled={disabled}
    >
      {(close) => <InviteSupervisorForm companyId={companyId} onDone={close} />}
    </FormSheet>
  );
}

function InviteSupervisorForm({ companyId, onDone }: { companyId: string; onDone: () => void }) {
  const { register, handleSubmit, formState } = useForm<InviteSupervisorInput>({
    resolver: zodResolver(inviteSupervisorSchema),
    defaultValues: { companyId, email: "" },
  });
  const action = useAction();
  const { errors } = formState;
  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={handleSubmit((values) => action.run(() => inviteSupervisor(values), onDone))}
    >
      <input type="hidden" {...register("companyId")} />
      <FormField id="sup-email" label="Email address" error={errors.email?.message}>
        <Input
          id="sup-email"
          type="email"
          autoComplete="off"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
      </FormField>
      <FormMessage message={action.message} />
      <SubmitRow label="Send invitation" pendingLabel="Sending invitation" pending={action.pending} />
    </form>
  );
}

// ----------------------------------------------------------------- invitations

export function InviteCoordinatorSheet({ courses }: { courses: Option[] }) {
  return (
    <FormSheet
      trigger="Invite coordinator"
      title="Invite coordinator"
      description="The coordinator manages one course. Add the department and course first."
      disabled={courses.length === 0}
    >
      {(close) => <InviteCoordinatorForm courses={courses} onDone={close} />}
    </FormSheet>
  );
}

function InviteCoordinatorForm({ courses, onDone }: { courses: Option[]; onDone: () => void }) {
  const { register, handleSubmit, formState } = useForm<InviteCoordinatorInput>({
    resolver: zodResolver(inviteCoordinatorSchema),
    defaultValues: { courseId: courses[0]?.value ?? "", email: "" },
  });
  const action = useAction();
  const { errors } = formState;
  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={handleSubmit((values) => action.run(() => inviteCoordinator(values), onDone))}
    >
      <FormField id="coord-course" label="Course" error={errors.courseId?.message}>
        <NativeSelect id="coord-course" {...register("courseId")}>
          {courses.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField id="coord-email" label="Email address" error={errors.email?.message}>
        <Input
          id="coord-email"
          type="email"
          autoComplete="off"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
      </FormField>
      <FormMessage message={action.message} />
      <SubmitRow label="Send invitation" pendingLabel="Sending invitation" pending={action.pending} />
    </form>
  );
}

export function InviteAdminSheet() {
  return (
    <FormSheet
      trigger="Invite admin"
      title="Invite admin"
      description="Admins sign in with Google only. Use the Google account's email address."
      variant="outline"
    >
      {(close) => <InviteAdminForm onDone={close} />}
    </FormSheet>
  );
}

function InviteAdminForm({ onDone }: { onDone: () => void }) {
  const { register, handleSubmit, formState } = useForm<InviteAdminInput>({
    resolver: zodResolver(inviteAdminSchema),
    defaultValues: { email: "" },
  });
  const action = useAction();
  const { errors } = formState;
  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={handleSubmit((values) => action.run(() => inviteAdmin(values), onDone))}
    >
      <FormField id="admin-email" label="Email address" error={errors.email?.message}>
        <Input
          id="admin-email"
          type="email"
          autoComplete="off"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
      </FormField>
      <FormMessage message={action.message} />
      <SubmitRow label="Send invitation" pendingLabel="Sending invitation" pending={action.pending} />
    </form>
  );
}

export function RevokeButton({ invitationId }: { invitationId: string }) {
  const action = useAction();
  return (
    <div className="grid justify-items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-error-text"
        disabled={action.pending}
        onClick={() => action.run(() => revokeInvitation({ invitationId }))}
      >
        {action.pending ? "Revoking invitation" : "Revoke"}
      </Button>
      {action.message ? <p className="max-w-48 text-xs text-error-text">{action.message}</p> : null}
    </div>
  );
}
