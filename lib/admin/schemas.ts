import { z } from "zod";

// Shared by the forms (client) and the server actions, so a rule is written
// once. Every field arrives as text from a form; the server turns required
// hours into a number after this check.

const text = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Enter ${label}.`)
    .max(max, `${label[0].toUpperCase()}${label.slice(1)} is too long.`);

const uuid = z.string().uuid("Choose an option from the list.");

const email = z
  .string()
  .trim()
  .min(1, "Enter an email address.")
  .email("Enter a valid email address.");

export const hoursText = z
  .string()
  .trim()
  .min(1, "Enter the required hours.")
  .refine((value) => /^\d{1,4}(\.\d{1,2})?$/.test(value), {
    message: "Enter hours as a number, for example 486.",
  })
  .refine((value) => Number(value) > 0, {
    message: "Required hours must be more than zero.",
  });

const schoolYear = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{4}$/, "Enter the school year like 2026-2027.")
  .refine((value) => Number(value.slice(5)) === Number(value.slice(0, 4)) + 1, {
    message: "The second year must follow the first, like 2026-2027.",
  });

const optionalDate = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Enter a valid date.",
  });

export const departmentSchema = z.object({
  code: text("a department code", 20),
  name: text("a department name", 120),
});

export const courseSchema = z.object({
  departmentId: uuid,
  code: text("a course code", 20),
  name: text("a course name", 120),
});

export const batchSchema = z
  .object({
    courseId: uuid,
    schoolYear,
    requiredHours: hoursText,
    startsOn: optionalDate,
    endsOn: optionalDate,
  })
  .refine(
    (value) =>
      value.startsOn === "" || value.endsOn === "" || value.endsOn >= value.startsOn,
    { message: "The end date cannot be before the start date.", path: ["endsOn"] },
  );

export const requiredHoursSchema = z.object({
  batchId: uuid,
  requiredHours: hoursText,
});

export const companySchema = z.object({
  name: text("a company name", 160),
  address: z.string().trim().max(300, "Address is too long."),
});

export const companyStatusSchema = z.object({
  companyId: uuid,
  status: z.enum(["active", "inactive"]),
});

export const inviteSupervisorSchema = z.object({ companyId: uuid, email });
export const inviteCoordinatorSchema = z.object({ courseId: uuid, email });
export const inviteAdminSchema = z.object({ email });
export const revokeInvitationSchema = z.object({ invitationId: uuid });
export const toggleUserActiveSchema = z.object({
  userId: uuid,
  active: z.boolean(),
});
export const transferOwnershipSchema = z.object({
  companyId: uuid,
  newOwnerId: uuid,
});

export const createListingSchema = z.object({
  companyId: uuid,
  title: z
    .string()
    .trim()
    .min(1, "Title is required.")
    .max(150, "Title is too long."),
  description: z.string().trim().max(2000, "Description is too long.").optional(),
  courseIds: z.array(uuid).min(1, "Select at least one course."),
});

export const updateListingSchema = z.object({
  listingId: uuid,
  title: z
    .string()
    .trim()
    .min(1, "Title is required.")
    .max(150, "Title is too long."),
  description: z.string().trim().max(2000, "Description is too long.").optional(),
  courseIds: z.array(uuid).min(1, "Select at least one course."),
});

export const setListingStatusSchema = z.object({
  listingId: uuid,
  status: z.enum(["open", "closed"]),
});

export const schoolSettingsSchema = z.object({
  name: z.string().trim().min(1, "School name is required.").max(150, "School name is too long."),
  timezone: z.string().trim().min(1, "Timezone is required.").max(50, "Timezone is too long."),
  consentNoticeVersion: z
    .string()
    .trim()
    .min(1, "Consent notice version is required.")
    .max(50, "Version is too long."),
});

export type DepartmentInput = z.infer<typeof departmentSchema>;
export type CourseInput = z.infer<typeof courseSchema>;
export type BatchInput = z.infer<typeof batchSchema>;
export type RequiredHoursInput = z.infer<typeof requiredHoursSchema>;
export type CompanyInput = z.infer<typeof companySchema>;
export type InviteSupervisorInput = z.infer<typeof inviteSupervisorSchema>;
export type InviteCoordinatorInput = z.infer<typeof inviteCoordinatorSchema>;
export type InviteAdminInput = z.infer<typeof inviteAdminSchema>;
export type ToggleUserActiveInput = z.infer<typeof toggleUserActiveSchema>;
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;
export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
export type SetListingStatusInput = z.infer<typeof setListingStatusSchema>;
export type SchoolSettingsInput = z.infer<typeof schoolSettingsSchema>;



