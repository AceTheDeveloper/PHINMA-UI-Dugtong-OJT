import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createClerkClient } from "@clerk/backend";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readTestUsers, seedFile, type E2eRole, type SeedIds, type TestUsers } from "./env.ts";

// Seeds the development database for the signed-in browser tests (ticket-36).
// Safe to run again. It only ever writes rows of its own: an "E2E" department,
// course, and batch, two "E2E" companies, and the four test users' accounts
// (found in Clerk by their `+clerk_test` emails). It never touches BSIT, a real
// company, or a real person.
//
// The student can time in once a day, and an approved entry can never be
// deleted (database guard rails). So the core-flow test ends by reopening its
// entry, which turns it back into a pending one, and the next run sets it aside
// here: moved to a free day in the past and marked rejected, so it counts for
// nothing and waits for nobody. (It is moved, not deleted: the guard trigger on
// daily_logs cancels every delete, see the ticket's notes.) If a run stopped with
// today's entry still approved, it stays locked until tomorrow and the flow test
// says so and skips.
//
// Run it with `npm run e2e:seed`; `npm run test:e2e` runs it first. It uses the
// service-role key, so run it only on a machine you trust.

const names = {
  department: { code: "E2E", name: "E2E Test Department" },
  course: { code: "E2E", name: "E2E Test Course" },
  company: "E2E Test Company",
  otherCompany: "E2E Other Company",
  listing: "E2E Test Listing",
};

const people: Record<E2eRole, { role: "coordinator" | "supervisor" | "student"; name: string }> = {
  coordinator: { role: "coordinator", name: "E2E Coordinator" },
  supervisorOwner: { role: "supervisor", name: "E2E Owner Supervisor" },
  supervisor: { role: "supervisor", name: "E2E Colleague Supervisor" },
  student: { role: "student", name: "E2E Student" },
};

type Row = Record<string, unknown>;

function must<T>(label: string, result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data as T;
}

const manilaDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function schoolToday(now: Date = new Date()): string {
  return manilaDate.format(now);
}

function daysAgo(days: number, today: string): string {
  const day = new Date(`${today}T12:00:00+08:00`);
  day.setUTCDate(day.getUTCDate() - days);
  return manilaDate.format(day);
}

// A clock time on a school date, as a moment (Manila has no daylight saving).
const at = (date: string, time: string) => `${date}T${time}:00+08:00`;

function schoolYear(today: string): string {
  const [year, month] = today.split("-").map(Number);
  const start = month >= 6 ? year : year - 1;
  return `${start}-${start + 1}`;
}

function connect() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const clerkKey = process.env.CLERK_SECRET_KEY;
  if (!url || !key || !clerkKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and CLERK_SECRET_KEY must be set in .env.local.");
  }
  const found = readTestUsers();
  if (!found.ok) throw new Error(found.reason);
  return {
    host: new URL(url).host,
    db: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
    clerk: createClerkClient({ secretKey: clerkKey }),
    users: found.users,
  };
}

async function one(db: SupabaseClient, label: string, table: string, match: Row): Promise<Row | null> {
  let query = db.from(table).select("*");
  for (const [column, value] of Object.entries(match)) query = query.eq(column, value as string);
  const rows = must(label, await query.limit(1));
  return (rows as Row[])[0] ?? null;
}

// Finds the row by its natural key, or inserts it. Returns the row.
async function ensure(db: SupabaseClient, label: string, table: string, match: Row, extra: Row = {}): Promise<Row> {
  const found = await one(db, label, table, match);
  if (found) return found;
  const inserted = must(label, await db.from(table).insert({ ...match, ...extra }).select("*").limit(1));
  return (inserted as Row[])[0];
}

async function ensureByName(db: SupabaseClient, table: "companies", name: string): Promise<Row> {
  const found = must(`find ${table}`, await db.from(table).select("*").ilike("name", name.replace(/[%_]/g, "\\$&")).limit(1)) as Row[];
  if (found[0]) {
    if (found[0].status !== "active") {
      must("reactivate company", await db.from("companies").update({ status: "active" }).eq("id", found[0].id as string).select("id"));
    }
    return found[0];
  }
  return ensure(db, "create company", table, { name }, { address: "Iloilo City (test data)" });
}

async function ensureUser(
  db: SupabaseClient,
  clerk: ReturnType<typeof createClerkClient>,
  role: E2eRole,
  email: string,
): Promise<string> {
  const { role: appRole, name } = people[role];
  const matches = await clerk.users.getUserList({ emailAddress: [email] });
  const clerkUser = matches.data[0];
  if (!clerkUser) {
    throw new Error(`There is no Clerk user for the ${role} test email. Create it in the Clerk development instance first.`);
  }
  const byClerk = await one(db, "find user", "users", { clerk_id: clerkUser.id });
  if (byClerk) {
    if (byClerk.role !== appRole) throw new Error(`The ${role} test user already has the role ${String(byClerk.role)} here.`);
    if (!byClerk.is_active) {
      must("reactivate user", await db.from("users").update({ is_active: true }).eq("id", byClerk.id as string).select("id"));
    }
    return byClerk.id as string;
  }
  const sameEmail = must("find user by email", await db.from("users").select("id").ilike("email", email).limit(1)) as Row[];
  if (sameEmail[0]) throw new Error(`The ${role} test email is already used by another account here.`);
  const created = await ensure(db, "create user", "users", { clerk_id: clerkUser.id }, { email, full_name: name, role: appRole });
  return created.id as string;
}

async function ensureRosterStudent(
  db: SupabaseClient,
  batch: Row,
  student: { number: string; name: string; email: string; userId?: string },
): Promise<string> {
  const found = await one(db, "find student", "students", { ojt_batch_id: batch.id, student_number: student.number });
  if (found) {
    if (!found.is_active) {
      must("reactivate student", await db.from("students").update({ is_active: true }).eq("id", found.id as string).select("id"));
    }
    return found.id as string;
  }
  const created = must(
    "create student",
    await db
      .from("students")
      .insert({
        ojt_batch_id: batch.id,
        course_id: batch.course_id,
        student_number: student.number,
        email: student.email,
        full_name: student.name,
        user_id: student.userId ?? null,
      })
      .select("id")
      .limit(1),
  ) as Row[];
  return created[0].id as string;
}

// The student's active deployment at the company: the one that is there, or a new
// one when there is none (which then gets a schedule and some history).
async function ensureDeployment(
  db: SupabaseClient,
  args: { studentId: string; companyId: string; listingId: string | null; batchId: string },
): Promise<{ id: string; created: boolean }> {
  const active = await one(db, "find deployment", "deployments", { student_id: args.studentId, status: "active" });
  if (active) {
    if (active.company_id !== args.companyId) throw new Error("A test student has an active deployment at another company.");
    return { id: active.id as string, created: false };
  }
  const created = must(
    "create deployment",
    await db
      .from("deployments")
      .insert({
        student_id: args.studentId,
        company_id: args.companyId,
        listing_id: args.listingId,
        ojt_batch_id: args.batchId,
        status: "active",
      })
      .select("id")
      .limit(1),
  ) as Row[];
  return { id: created[0].id as string, created: true };
}

// Sets aside today's entries of the student that are not approved (the flow
// test's own, reopened at its end), so the student can time in again: each is
// moved to a free earlier day and marked rejected. Returns how many approved ones
// are left, which are locked until tomorrow.
async function releaseToday(db: SupabaseClient, studentId: string, today: string): Promise<number> {
  const deployments = must("find deployments", await db.from("deployments").select("id").eq("student_id", studentId)) as Row[];
  const ids = deployments.map((row) => row.id as string);
  if (ids.length === 0) return 0;
  const logs = must(
    "find today's entries",
    await db.from("daily_logs").select("id, deployment_id, status, time_out").in("deployment_id", ids).eq("log_date", today),
  ) as Row[];
  let locked = 0;
  for (const log of logs) {
    if (log.status === "approved") {
      locked += 1;
      continue;
    }
    const taken = new Set(
      (must("find days", await db.from("daily_logs").select("log_date").eq("deployment_id", log.deployment_id as string)) as Row[]).map(
        (row) => row.log_date as string,
      ),
    );
    let date = "";
    for (let back = 6; back < 800 && !date; back += 1) {
      const candidate = daysAgo(back, today);
      if (!taken.has(candidate)) date = candidate;
    }
    if (!date) throw new Error("The seed could not find a free day to set a test entry aside.");
    must(
      "set the entry aside",
      await db
        .from("daily_logs")
        .update({
          log_date: date,
          time_in: at(date, "08:00"),
          time_out: log.time_out ? at(date, "12:00") : null,
          status: "rejected",
          reject_reason: "A browser test entry, set aside.",
        })
        .eq("id", log.id as string)
        .select("id"),
    );
  }
  return locked;
}

// An earlier pending entry for the supervisor's approval screen, made when the
// seed finds none (someone approved it).
async function ensurePending(db: SupabaseClient, deploymentId: string, ownerId: string, today: string): Promise<string> {
  const found = must(
    "find pending entry",
    await db.from("daily_logs").select("id").eq("deployment_id", deploymentId).eq("status", "pending").lt("log_date", today).limit(1),
  ) as Row[];
  if (found[0]) return found[0].id as string;
  for (let back = 1; back < 60; back += 1) {
    const date = daysAgo(back, today);
    if (await one(db, "find entry", "daily_logs", { deployment_id: deploymentId, log_date: date })) continue;
    const made = await history(db, deploymentId, ownerId, today, [
      { daysAgo: back, status: "pending", journal: "Updated the inventory sheet and met the team." },
    ]);
    return made.pending;
  }
  throw new Error("The seed could not find a day for a pending entry.");
}

// A schedule that covers every day from midnight to 23:59, so a student can time
// in at any hour. (Timing out before the end asks for a reason, which is the
// path the tests take.)
async function allDaySchedule(db: SupabaseClient, deploymentId: string, ownerId: string, today: string) {
  const schedule = must(
    "create schedule",
    await db
      .from("work_schedules")
      .insert({ deployment_id: deploymentId, effective_from: daysAgo(60, today), created_by: ownerId })
      .select("id")
      .limit(1),
  ) as Row[];
  const days = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    schedule_id: schedule[0].id,
    weekday,
    start_time: "00:00",
    end_time: "23:59",
  }));
  must("create schedule days", await db.from("work_schedule_days").insert(days).select("id"));
}

type Entry = {
  daysAgo: number;
  status: "approved" | "pending" | "rejected" | "open";
  journal: string;
  rejectReason?: string;
};

async function history(db: SupabaseClient, deploymentId: string, ownerId: string, today: string, entries: Entry[]): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const entry of entries) {
    const date = daysAgo(entry.daysAgo, today);
    const open = entry.status === "open";
    const inserted = must(
      "create entry",
      await db
        .from("daily_logs")
        .insert({
          deployment_id: deploymentId,
          log_date: date,
          time_in: at(date, "08:00"),
          time_out: open ? null : at(date, "17:00"),
          break_minutes: open ? 0 : 60,
          journal: entry.journal,
          status: entry.status,
          reject_reason: entry.status === "rejected" ? (entry.rejectReason ?? "Add more detail.") : null,
          approved_by: entry.status === "approved" ? ownerId : null,
          approved_at: entry.status === "approved" ? at(date, "18:00") : null,
          schedule_start: "00:00",
          schedule_end: "23:59",
        })
        .select("id")
        .limit(1),
    ) as Row[];
    ids[entry.status] = ids[entry.status] ?? (inserted[0].id as string);
  }
  return ids;
}

export type SeedResult = { ids: SeedIds; host: string; newDeployment: boolean };

export async function seedE2e(): Promise<SeedResult> {
  const { db, clerk, users, host } = connect();
  const today = schoolToday();

  const userIds = {} as Record<E2eRole, string>;
  for (const role of Object.keys(people) as E2eRole[]) {
    userIds[role] = await ensureUser(db, clerk, role, users[role]);
  }

  // Everyone has accepted the current privacy notice, so no screen stops at it.
  const settings = must("read settings", await db.from("school_settings").select("consent_notice_version").limit(1)) as Row[];
  const version = settings[0].consent_notice_version as string;
  must(
    "record consent",
    await db
      .from("consents")
      .upsert(
        Object.values(userIds).map((userId) => ({ user_id: userId, notice_version: version })),
        { onConflict: "user_id,notice_version", ignoreDuplicates: true },
      )
      .select("user_id"),
  );

  const department = await ensure(db, "department", "departments", { code: names.department.code }, { name: names.department.name });
  const course = await ensure(db, "course", "courses", { department_id: department.id, code: names.course.code }, { name: names.course.name });
  const batch = await ensure(
    db,
    "batch",
    "ojt_batches",
    { course_id: course.id, school_year: schoolYear(today) },
    { required_hours: 80, status: "active" },
  );

  must(
    "assign coordinator",
    await db
      .from("coordinator_assignments")
      .upsert({ user_id: userIds.coordinator, course_id: course.id }, { onConflict: "user_id,course_id", ignoreDuplicates: true })
      .select("user_id"),
  );

  const company = await ensureByName(db, "companies", names.company);
  const otherCompany = await ensureByName(db, "companies", names.otherCompany);
  await ensure(db, "owner membership", "supervisor_memberships", { user_id: userIds.supervisorOwner }, { company_id: company.id, is_owner: true });
  await ensure(db, "colleague membership", "supervisor_memberships", { user_id: userIds.supervisor }, { company_id: company.id, is_owner: false });
  for (const role of ["supervisorOwner", "supervisor"] as const) {
    const member = await one(db, "find membership", "supervisor_memberships", { user_id: userIds[role] });
    if (member && member.company_id !== company.id) {
      throw new Error(`The ${role} test user already belongs to another company here.`);
    }
  }

  const listing = await ensure(
    db,
    "listing",
    "listings",
    { company_id: company.id, title: names.listing },
    { description: "A test listing for the browser tests.", status: "open", created_by: userIds.supervisorOwner },
  );
  must(
    "listing course",
    await db
      .from("listing_courses")
      .upsert({ listing_id: listing.id, course_id: course.id }, { onConflict: "listing_id,course_id", ignoreDuplicates: true })
      .select("listing_id"),
  );

  const studentId = await ensureRosterStudent(db, batch, { number: "E2E-0001", name: people.student.name, email: users.student, userId: userIds.student });
  const applicantId = await ensureRosterStudent(db, batch, { number: "E2E-0002", name: "E2E Applicant", email: "e2e.applicant@example.test" });
  const otherStudentId = await ensureRosterStudent(db, batch, { number: "E2E-0003", name: "E2E Other Student", email: "e2e.other@example.test" });
  await ensureRosterStudent(db, batch, { number: "E2E-0004", name: "E2E Unplaced Student", email: "e2e.unplaced@example.test" });

  await ensure(db, "student application", "applications", { student_id: studentId, listing_id: listing.id }, { status: "accepted" });
  await ensure(db, "applicant application", "applications", { student_id: applicantId, listing_id: listing.id }, { status: "applied" });

  const ownerId = userIds.supervisorOwner;
  const deployment = await ensureDeployment(db, {
    studentId,
    companyId: company.id as string,
    listingId: listing.id as string,
    batchId: batch.id as string,
  });
  if (deployment.created) {
    await allDaySchedule(db, deployment.id, ownerId, today);
    await history(db, deployment.id, ownerId, today, [
      { daysAgo: 2, status: "approved", journal: "Helped set up the new workstations." },
      { daysAgo: 3, status: "approved", journal: "Tested the login page with the supervisor." },
      { daysAgo: 4, status: "rejected", journal: "Worked.", rejectReason: "Add what you worked on." },
      { daysAgo: 5, status: "open", journal: "" },
    ]);
  }
  const pendingLogId = await ensurePending(db, deployment.id, ownerId, today);
  const lockedToday = await releaseToday(db, studentId, today);

  // A student at the other company, so the tests can prove a supervisor, a
  // student, and the coordinator's company page see only what is theirs.
  const other = await ensureDeployment(db, {
    studentId: otherStudentId,
    companyId: otherCompany.id as string,
    listingId: null,
    batchId: batch.id as string,
  });
  if (other.created) {
    await history(db, other.id, ownerId, today, [{ daysAgo: 2, status: "approved", journal: "Filed the month's receipts." }]);
  }

  const ids: SeedIds = {
    courseId: course.id as string,
    batchId: batch.id as string,
    companyId: company.id as string,
    otherCompanyId: otherCompany.id as string,
    studentId,
    otherStudentId,
    deploymentId: deployment.id,
    otherDeploymentId: other.id,
    pendingLogId,
    today,
    todayLocked: lockedToday > 0,
  };
  mkdirSync(dirname(seedFile), { recursive: true });
  writeFileSync(seedFile, `${JSON.stringify(ids, null, 2)}\n`);
  return { ids, host, newDeployment: deployment.created };
}

// Puts the test data to rest: ends the E2E deployments, closes the E2E listing,
// makes the E2E companies inactive, and deactivates the E2E accounts. Entries and
// the audit log stay, by design. Running the seed again brings it all back.
export async function cleanE2e(): Promise<{ host: string }> {
  const { db, users, host } = connect();
  const course = await one(db, "find course", "courses", { code: names.course.code });
  const companies = must("find companies", await db.from("companies").select("id").in("name", [names.company, names.otherCompany])) as Row[];
  const companyIds = companies.map((row) => row.id as string);
  if (companyIds.length > 0) {
    must("end deployments", await db.from("deployments").update({ status: "ended" }).in("company_id", companyIds).eq("status", "active").select("id"));
    must("close listings", await db.from("listings").update({ status: "closed" }).in("company_id", companyIds).select("id"));
    must("deactivate companies", await db.from("companies").update({ status: "inactive" }).in("id", companyIds).select("id"));
  }
  if (course) {
    must("deactivate students", await db.from("students").update({ is_active: false }).eq("course_id", course.id as string).select("id"));
  }
  for (const email of Object.values(users as TestUsers)) {
    must("deactivate user", await db.from("users").update({ is_active: false }).ilike("email", email).select("id"));
  }
  return { host };
}
