"use client";

import { useState } from "react";
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
  addListing,
  editListing,
  changeListingStatus,
} from "@/app/(app)/admin/actions";
import {
  createListingSchema,
  updateListingSchema,
  type CreateListingInput,
  type UpdateListingInput,
} from "@/lib/admin/schemas";
import type { AdminListingSummary } from "@/lib/admin/queries";
import type { Option } from "@/components/admin/forms";

export function AddListingSheet({
  companies,
  courses,
  companyId,
  companyName,
}: {
  companies: Option[];
  courses: Option[];
  companyId?: string;
  companyName?: string;
}) {
  return (
    <FormSheet
      trigger="Add listing"
      title="Add listing"
      description={
        companyName
          ? `Create an OJT opportunity for ${companyName}.`
          : "Create an OJT opportunity for a partner company."
      }
      disabled={companies.length === 0 || courses.length === 0}
    >
      {(close) => (
        <AddListingForm
          companies={companies}
          courses={courses}
          defaultCompanyId={companyId}
          onDone={close}
        />
      )}
    </FormSheet>
  );
}

function AddListingForm({
  companies,
  courses,
  defaultCompanyId,
  onDone,
}: {
  companies: Option[];
  courses: Option[];
  defaultCompanyId?: string;
  onDone: () => void;
}) {
  const [selectedCourses, setSelectedCourses] = useState<string[]>(
    courses[0] ? [courses[0].value] : [],
  );

  const { register, handleSubmit, setValue, formState } = useForm<CreateListingInput>({
    resolver: zodResolver(createListingSchema),
    defaultValues: {
      companyId: defaultCompanyId ?? companies[0]?.value ?? "",
      title: "",
      description: "",
      courseIds: courses[0] ? [courses[0].value] : [],
    },
  });

  const action = useAction();
  const { errors } = formState;

  const handleCourseToggle = (courseId: string, checked: boolean) => {
    const next = checked
      ? [...selectedCourses, courseId]
      : selectedCourses.filter((id) => id !== courseId);
    setSelectedCourses(next);
    setValue("courseIds", next, { shouldValidate: true });
  };

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={handleSubmit((values) => action.run(() => addListing(values), onDone))}
    >
      {defaultCompanyId ? (
        <input type="hidden" {...register("companyId")} />
      ) : (
        <FormField id="listing-company" label="Company" error={errors.companyId?.message}>
          <NativeSelect id="listing-company" {...register("companyId")}>
            {companies.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      )}

      <FormField
        id="listing-title"
        label="Title"
        error={errors.title?.message}
        hint="For example Frontend Developer Intern."
      >
        <Input
          id="listing-title"
          autoComplete="off"
          aria-invalid={!!errors.title}
          {...register("title")}
        />
      </FormField>

      <FormField
        id="listing-desc"
        label="Description (optional)"
        error={errors.description?.message}
        hint="Responsibilities, skills, or available slots."
      >
        <textarea
          id="listing-desc"
          rows={4}
          className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
          {...register("description")}
        />
      </FormField>

      <FormField
        id="listing-courses"
        label="Open to courses"
        error={errors.courseIds?.message}
        hint="Select at least one course."
      >
        <div className="grid gap-2 pt-1">
          {courses.map((course) => (
            <label
              key={course.value}
              className="flex cursor-pointer items-center gap-2 text-sm font-normal text-ink"
            >
              <input
                type="checkbox"
                value={course.value}
                checked={selectedCourses.includes(course.value)}
                onChange={(e) => handleCourseToggle(course.value, e.target.checked)}
                className="size-4 rounded border-input text-primary focus:ring-primary"
              />
              <span>{course.label}</span>
            </label>
          ))}
        </div>
      </FormField>

      <FormMessage message={action.message} />
      <SubmitRow label="Add listing" pendingLabel="Adding listing" pending={action.pending} />
    </form>
  );
}

export function EditListingSheet({
  listing,
  courses,
}: {
  listing: AdminListingSummary;
  courses: Option[];
}) {
  return (
    <FormSheet
      trigger="Edit"
      title="Edit listing"
      description={`Update ${listing.title}. Changes are recorded in the audit log.`}
      variant="ghost"
      size="sm"
      showPlus={false}
    >
      {(close) => <EditListingForm listing={listing} courses={courses} onDone={close} />}
    </FormSheet>
  );
}

function EditListingForm({
  listing,
  courses,
  onDone,
}: {
  listing: AdminListingSummary;
  courses: Option[];
  onDone: () => void;
}) {
  const [selectedCourses, setSelectedCourses] = useState<string[]>(listing.courseIds);

  const { register, handleSubmit, setValue, formState } = useForm<UpdateListingInput>({
    resolver: zodResolver(updateListingSchema),
    defaultValues: {
      listingId: listing.id,
      title: listing.title,
      description: listing.description ?? "",
      courseIds: listing.courseIds,
    },
  });

  const action = useAction();
  const { errors } = formState;

  const handleCourseToggle = (courseId: string, checked: boolean) => {
    const next = checked
      ? [...selectedCourses, courseId]
      : selectedCourses.filter((id) => id !== courseId);
    setSelectedCourses(next);
    setValue("courseIds", next, { shouldValidate: true });
  };

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={handleSubmit((values) => action.run(() => editListing(values), onDone))}
    >
      <input type="hidden" {...register("listingId")} />

      <FormField id="edit-listing-title" label="Title" error={errors.title?.message}>
        <Input
          id="edit-listing-title"
          autoComplete="off"
          aria-invalid={!!errors.title}
          {...register("title")}
        />
      </FormField>

      <FormField
        id="edit-listing-desc"
        label="Description (optional)"
        error={errors.description?.message}
      >
        <textarea
          id="edit-listing-desc"
          rows={4}
          className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
          {...register("description")}
        />
      </FormField>

      <FormField
        id="edit-listing-courses"
        label="Open to courses"
        error={errors.courseIds?.message}
        hint="Select at least one course."
      >
        <div className="grid gap-2 pt-1">
          {courses.map((course) => (
            <label
              key={course.value}
              className="flex cursor-pointer items-center gap-2 text-sm font-normal text-ink"
            >
              <input
                type="checkbox"
                value={course.value}
                checked={selectedCourses.includes(course.value)}
                onChange={(e) => handleCourseToggle(course.value, e.target.checked)}
                className="size-4 rounded border-input text-primary focus:ring-primary"
              />
              <span>{course.label}</span>
            </label>
          ))}
        </div>
      </FormField>

      <FormMessage message={action.message} />
      <SubmitRow label="Save changes" pendingLabel="Saving changes" pending={action.pending} />
    </form>
  );
}

export function ListingStatusButton({
  listingId,
  status,
}: {
  listingId: string;
  status: "open" | "closed";
}) {
  const action = useAction();
  const next = status === "open" ? "closed" : "open";
  return (
    <div className="grid justify-items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={action.pending}
        onClick={() => action.run(() => changeListingStatus({ listingId, status: next }))}
      >
        {action.pending
          ? status === "open"
            ? "Closing listing"
            : "Opening listing"
          : status === "open"
            ? "Close listing"
            : "Open listing"}
      </Button>
      {action.message ? <p className="max-w-48 text-xs text-error-text">{action.message}</p> : null}
    </div>
  );
}
