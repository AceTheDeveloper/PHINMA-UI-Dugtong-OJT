"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import {
  batchSchema,
  companySchema,
  companyStatusSchema,
  courseSchema,
  createListingSchema,
  departmentSchema,
  inviteAdminSchema,
  inviteCoordinatorSchema,
  inviteSupervisorSchema,
  requiredHoursSchema,
  revokeInvitationSchema,
  setListingStatusSchema,
  toggleUserActiveSchema,
  transferOwnershipSchema,
  updateListingSchema,
} from "@/lib/admin/schemas";
import { inviteUser, revokeInvitationEverywhere } from "@/lib/auth/invitations";
import { authorize } from "@/lib/auth/server";
import type { Session } from "@/lib/auth/session";
import {
  createCompany,
  createCourse,
  createDepartment,
  createListing,
  createOjtBatch,
  setCompanyStatus,
  setListingStatus,
  setOjtRequiredHours,
  setUserActive,
  transferCompanyOwnership,
  updateListing,
} from "@/lib/db/rpc";
import { fail, ok, type Result } from "@/lib/result";

// Every Admin action: check the caller is an active Admin, validate the input,
// call the database function (which checks the Admin role again), then refresh
// the screens that show the data. Expected failures come back as typed results.

type ActionResult = Result<null>;

async function run<S extends z.ZodType>(
  schema: S,
  raw: unknown,
  paths: string[],
  work: (session: Session, input: z.infer<S>) => Promise<Result<unknown>>,
): Promise<ActionResult> {
  const access = await authorize(["admin"]);
  if (!access.ok) return access;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return fail(
      "validation",
      parsed.error.issues[0]?.message ?? "Check the details and try again.",
    );
  }
  const result = await work(access.data, parsed.data);
  if (!result.ok) return result;
  for (const path of paths) revalidatePath(path);
  return ok(null);
}

const academics = ["/admin", "/admin/academics", "/admin/audit"];
const companies = ["/admin", "/admin/companies", "/admin/audit"];
const listings = ["/admin", "/admin/listings", "/admin/companies", "/admin/audit"];
const people = ["/admin", "/admin/people", "/admin/audit"];

export async function addDepartment(raw: unknown): Promise<ActionResult> {
  return run(departmentSchema, raw, academics, (session, input) =>
    createDepartment(session.userId, input),
  );
}

export async function addCourse(raw: unknown): Promise<ActionResult> {
  return run(courseSchema, raw, academics, (session, input) =>
    createCourse(session.userId, input),
  );
}

export async function addOjtBatch(raw: unknown): Promise<ActionResult> {
  return run(batchSchema, raw, academics, (session, input) =>
    createOjtBatch(session.userId, {
      courseId: input.courseId,
      schoolYear: input.schoolYear,
      requiredHours: Number(input.requiredHours),
      startsOn: input.startsOn === "" ? null : input.startsOn,
      endsOn: input.endsOn === "" ? null : input.endsOn,
    }),
  );
}

export async function changeRequiredHours(raw: unknown): Promise<ActionResult> {
  return run(requiredHoursSchema, raw, academics, (session, input) =>
    setOjtRequiredHours(session.userId, input.batchId, Number(input.requiredHours)),
  );
}

export async function addCompany(raw: unknown): Promise<ActionResult> {
  return run(companySchema, raw, companies, (session, input) =>
    createCompany(session.userId, {
      name: input.name,
      address: input.address === "" ? null : input.address,
    }),
  );
}

export async function changeCompanyStatus(raw: unknown): Promise<ActionResult> {
  return run(companyStatusSchema, raw, companies, (session, input) =>
    setCompanyStatus(session.userId, input.companyId, input.status),
  );
}

export async function inviteSupervisor(raw: unknown): Promise<ActionResult> {
  return run(inviteSupervisorSchema, raw, [...companies, ...people], (session, input) =>
    inviteUser({
      actorId: session.userId,
      role: "supervisor",
      email: input.email,
      companyId: input.companyId,
    }),
  );
}

export async function inviteCoordinator(raw: unknown): Promise<ActionResult> {
  return run(inviteCoordinatorSchema, raw, people, (session, input) =>
    inviteUser({
      actorId: session.userId,
      role: "coordinator",
      email: input.email,
      courseId: input.courseId,
    }),
  );
}

export async function inviteAdmin(raw: unknown): Promise<ActionResult> {
  return run(inviteAdminSchema, raw, people, (session, input) =>
    inviteUser({ actorId: session.userId, role: "admin", email: input.email }),
  );
}

export async function revokeInvitation(raw: unknown): Promise<ActionResult> {
  return run(revokeInvitationSchema, raw, [...companies, ...people], (session, input) =>
    revokeInvitationEverywhere(session.userId, input.invitationId),
  );
}

export async function toggleUserActive(raw: unknown): Promise<ActionResult> {
  return run(toggleUserActiveSchema, raw, people, (session, input) =>
    setUserActive(session.userId, input.userId, input.active),
  );
}

export async function transferOwnership(raw: unknown): Promise<ActionResult> {
  return run(transferOwnershipSchema, raw, companies, (session, input) => {
    revalidatePath(`/admin/companies/${input.companyId}`);
    return transferCompanyOwnership(session.userId, input.companyId, input.newOwnerId);
  });
}

export async function addListing(raw: unknown): Promise<ActionResult> {
  return run(createListingSchema, raw, listings, (session, input) => {
    revalidatePath(`/admin/companies/${input.companyId}`);
    return createListing(session.userId, input);
  });
}

export async function editListing(raw: unknown): Promise<ActionResult> {
  return run(updateListingSchema, raw, listings, (session, input) =>
    updateListing(session.userId, input),
  );
}

export async function changeListingStatus(raw: unknown): Promise<ActionResult> {
  return run(setListingStatusSchema, raw, listings, (session, input) =>
    setListingStatus(session.userId, input.listingId, input.status),
  );
}



