// What the signed-in browser tests need from the environment (ticket-36). The
// four test users are made by hand in the Clerk development instance with
// `+clerk_test` emails; their emails go in .env.local. No password is stored:
// the tests sign in with Clerk's testing tokens. Everything here uses relative
// imports only, so the seed script can run it under plain Node.

export const e2eRoles = ["coordinator", "supervisorOwner", "supervisor", "student"] as const;
export type E2eRole = (typeof e2eRoles)[number];

export const emailVariables: Record<E2eRole, string> = {
  coordinator: "E2E_COORDINATOR_EMAIL",
  supervisorOwner: "E2E_SUPERVISOR_OWNER_EMAIL",
  supervisor: "E2E_SUPERVISOR_EMAIL",
  student: "E2E_STUDENT_EMAIL",
};

// The app role behind each test user, and where the person lands after signing in.
export const roleHome: Record<E2eRole, { appRole: "coordinator" | "supervisor" | "student"; home: string }> = {
  coordinator: { appRole: "coordinator", home: "/coordinator" },
  supervisorOwner: { appRole: "supervisor", home: "/supervisor" },
  supervisor: { appRole: "supervisor", home: "/supervisor" },
  student: { appRole: "student", home: "/student" },
};

export function authFile(role: E2eRole): string {
  return `playwright/.auth/${role}.json`;
}

export const seedFile = "playwright/.seed.json";

export type TestUsers = Record<E2eRole, string>;

// The test users' emails, or why they cannot be used. Only an address with
// `+clerk_test` is accepted: Clerk treats it as a test user, and the seed refuses
// anything else, so it can never write for a real person.
export function readTestUsers(env: NodeJS.ProcessEnv = process.env): { ok: true; users: TestUsers } | { ok: false; reason: string } {
  const users = {} as TestUsers;
  for (const role of e2eRoles) {
    const name = emailVariables[role];
    const value = env[name]?.trim().toLowerCase();
    if (!value) return { ok: false, reason: `${name} is not set in .env.local.` };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return { ok: false, reason: `${name} is not an email address.` };
    if (!value.split("@")[0].includes("+clerk_test")) {
      return { ok: false, reason: `${name} must contain +clerk_test (for example name+clerk_test@example.com).` };
    }
    users[role] = value;
  }
  const distinct = new Set(Object.values(users));
  if (distinct.size !== e2eRoles.length) return { ok: false, reason: "Each test user needs a different email." };
  return { ok: true, users };
}

// Ids the seed leaves for the specs, so a spec can open a student, a company, or a
// deployment of its own and one that belongs to someone else.
export type SeedIds = {
  courseId: string;
  batchId: string;
  companyId: string;
  otherCompanyId: string;
  studentId: string; // roster record of the student test user
  otherStudentId: string; // roster record of a student at the other company
  deploymentId: string; // the student test user's active deployment
  otherDeploymentId: string; // a deployment at the other company
  pendingLogId: string; // an entry waiting for approval
  today: string; // school date the seed ran for, YYYY-MM-DD
  // The student already has an approved entry for today, which is locked until
  // tomorrow, so the core-flow test cannot time in again today.
  todayLocked: boolean;
};
