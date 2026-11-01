import { describe, expect, it } from "vitest";
import {
  canAccessCompany,
  canAccessCourse,
  isCompanyOwner,
  isOwnStudentRecord,
} from "@/lib/auth/scope";
import type { Role } from "@/lib/auth/roles";
import type { Session } from "@/lib/auth/session";

const courseA = "00000000-0000-4000-8000-00000000000a";
const courseB = "00000000-0000-4000-8000-00000000000b";
const companyA = "00000000-0000-4000-8000-0000000000c1";
const companyB = "00000000-0000-4000-8000-0000000000c2";
const studentA = "00000000-0000-4000-8000-0000000000a1";
const studentB = "00000000-0000-4000-8000-0000000000b1";

function session(role: Role, overrides: Partial<Session> = {}): Session {
  return {
    userId: "00000000-0000-4000-8000-000000000001",
    clerkId: "clerk-1",
    role,
    studentId: null,
    courseIds: [],
    companyId: null,
    isCompanyOwner: false,
    hasConsent: true,
    ...overrides,
  };
}

describe("canAccessCourse", () => {
  it("lets an admin reach any course", () => {
    expect(canAccessCourse(session("admin"), courseA)).toBe(true);
  });

  it("lets a coordinator reach only their courses", () => {
    const coordinator = session("coordinator", { courseIds: [courseA] });
    expect(canAccessCourse(coordinator, courseA)).toBe(true);
    expect(canAccessCourse(coordinator, courseB)).toBe(false);
  });

  it("lets a student reach only their own course", () => {
    const student = session("student", { studentId: studentA, courseIds: [courseA] });
    expect(canAccessCourse(student, courseA)).toBe(true);
    expect(canAccessCourse(student, courseB)).toBe(false);
  });

  it("never lets a supervisor reach a course", () => {
    expect(canAccessCourse(session("supervisor", { courseIds: [courseA] }), courseA)).toBe(false);
  });
});

describe("canAccessCompany", () => {
  it("lets an admin reach any company", () => {
    expect(canAccessCompany(session("admin"), companyA)).toBe(true);
  });

  it("lets a supervisor reach only their company", () => {
    const supervisor = session("supervisor", { companyId: companyA });
    expect(canAccessCompany(supervisor, companyA)).toBe(true);
    expect(canAccessCompany(supervisor, companyB)).toBe(false);
  });

  it("never lets a coordinator or student reach a company", () => {
    expect(canAccessCompany(session("coordinator", { companyId: companyA }), companyA)).toBe(false);
    expect(canAccessCompany(session("student", { companyId: companyA }), companyA)).toBe(false);
  });
});

describe("isCompanyOwner", () => {
  it("is true only for the owner of that company", () => {
    const owner = session("supervisor", { companyId: companyA, isCompanyOwner: true });
    expect(isCompanyOwner(owner, companyA)).toBe(true);
    expect(isCompanyOwner(owner, companyB)).toBe(false);
  });

  it("is false for a member, and for any other role", () => {
    expect(isCompanyOwner(session("supervisor", { companyId: companyA }), companyA)).toBe(false);
    expect(
      isCompanyOwner(session("admin", { companyId: companyA, isCompanyOwner: true }), companyA),
    ).toBe(false);
  });
});

describe("isOwnStudentRecord", () => {
  it("is true only for the student's own record", () => {
    const student = session("student", { studentId: studentA });
    expect(isOwnStudentRecord(student, studentA)).toBe(true);
    expect(isOwnStudentRecord(student, studentB)).toBe(false);
  });

  it("is false for any other role", () => {
    expect(isOwnStudentRecord(session("admin", { studentId: studentA }), studentA)).toBe(false);
  });
});
