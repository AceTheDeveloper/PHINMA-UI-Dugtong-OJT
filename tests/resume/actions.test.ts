import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/roles";
import type { Session } from "@/lib/auth/session";
import { fail, ok } from "@/lib/result";

// The resume actions are the only door the browser has to the resumes bucket.
// The session, the database layer, and Storage are faked; file validation is
// real. These tests prove who may call each action, that the student id comes
// from the session, and that a bad file never reaches Storage or the database.

vi.mock("server-only", () => ({}));

const authorize = vi.fn();
vi.mock("@/lib/auth/server", () => ({ authorize: (...args: unknown[]) => authorize(...args) }));

const rpc = { saveResume: vi.fn(), getResumePath: vi.fn() };
vi.mock("@/lib/db/rpc", () => rpc);

const storage = {
  resumePathFor: (id: string) => `${id}/resume.pdf`,
  storeResume: vi.fn(),
  signResumeLink: vi.fn(),
};
vi.mock("@/lib/resume/storage", () => storage);

const actions = await import("@/app/(app)/student/resume/actions");

const userId = "00000000-0000-4000-8000-000000000001";
const studentId = "00000000-0000-4000-8000-0000000000a1";
const otherStudentId = "00000000-0000-4000-8000-0000000000a2";

function session(role: Role, ownStudentId: string | null = studentId): Session {
  return {
    userId,
    clerkId: "clerk-1",
    role,
    studentId: role === "student" ? ownStudentId : null,
    courseIds: [],
    companyId: null,
    isCompanyOwner: false,
    hasConsent: true,
  };
}

function allow(role: Role, ownStudentId: string | null = studentId) {
  authorize.mockImplementation(async (allowed: readonly Role[]) =>
    allowed.includes(role)
      ? ok(session(role, ownStudentId))
      : fail("forbidden", "You do not have access to this."),
  );
}

function upload(content = "%PDF-1.7 hi", name = "resume.pdf", type = "application/pdf") {
  const form = new FormData();
  form.set("file", new File([content], name, { type }));
  return form;
}

beforeEach(() => {
  vi.resetAllMocks();
  storage.storeResume.mockResolvedValue(ok(null));
  storage.signResumeLink.mockResolvedValue(ok("https://signed.example/link"));
  rpc.saveResume.mockImplementation(async () => ok(`${studentId}/resume.pdf`));
  rpc.getResumePath.mockResolvedValue(ok(`${studentId}/resume.pdf`));
});

describe("uploadResume", () => {
  it("stores the PDF at the session student's path, then records it", async () => {
    allow("student");
    expect(await actions.uploadResume(upload())).toEqual({ ok: true, data: null });
    expect(storage.storeResume).toHaveBeenCalledWith(
      `${studentId}/resume.pdf`,
      expect.any(Uint8Array),
    );
    expect(rpc.saveResume).toHaveBeenCalledWith(userId, "%PDF-1.7 hi".length);
  });

  it("ignores a student id sent by the browser", async () => {
    allow("student");
    const form = upload();
    form.set("studentId", otherStudentId);
    await actions.uploadResume(form);
    expect(storage.storeResume).toHaveBeenCalledWith(
      `${studentId}/resume.pdf`,
      expect.anything(),
    );
  });

  it.each(["coordinator", "supervisor", "admin"] as const)("refuses a %s", async (role) => {
    allow(role);
    expect(await actions.uploadResume(upload())).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    expect(storage.storeResume).not.toHaveBeenCalled();
    expect(rpc.saveResume).not.toHaveBeenCalled();
  });

  it("refuses a signed-out visitor", async () => {
    authorize.mockResolvedValue(fail("unauthenticated", "Sign in to continue."));
    expect(await actions.uploadResume(upload())).toMatchObject({
      ok: false,
      error: { code: "unauthenticated" },
    });
    expect(storage.storeResume).not.toHaveBeenCalled();
  });

  it("refuses a student account with no student record", async () => {
    allow("student", null);
    expect(await actions.uploadResume(upload())).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    expect(storage.storeResume).not.toHaveBeenCalled();
  });

  it.each([
    ["a non-PDF", () => upload("hello", "resume.txt", "text/plain")],
    ["a renamed file", () => upload("not a pdf", "resume.pdf", "application/pdf")],
    ["an empty file", () => upload("")],
    ["no file", () => new FormData()],
    ["a file over 2 MB", () => upload("%PDF-" + "a".repeat(2 * 1024 * 1024))],
  ])("stores nothing for %s", async (_label, makeForm) => {
    allow("student");
    expect(await actions.uploadResume(makeForm())).toMatchObject({
      ok: false,
      error: { code: "validation" },
    });
    expect(storage.storeResume).not.toHaveBeenCalled();
    expect(rpc.saveResume).not.toHaveBeenCalled();
  });

  it("does not record a resume when Storage fails", async () => {
    allow("student");
    storage.storeResume.mockResolvedValue(
      fail("unexpected", "Something went wrong. Try again in a moment."),
    );
    expect(await actions.uploadResume(upload())).toMatchObject({
      ok: false,
      error: { code: "unexpected" },
    });
    expect(rpc.saveResume).not.toHaveBeenCalled();
  });

  it("reports the database's refusal", async () => {
    allow("student");
    rpc.saveResume.mockResolvedValue(fail("forbidden", "No active student record."));
    expect(await actions.uploadResume(upload())).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
  });

  it("fails if the database path is not the stored path", async () => {
    allow("student");
    rpc.saveResume.mockResolvedValue(ok(`${otherStudentId}/resume.pdf`));
    expect(await actions.uploadResume(upload())).toMatchObject({
      ok: false,
      error: { code: "unexpected" },
    });
  });
});

describe("getResumeLink", () => {
  it.each(["student", "coordinator", "supervisor"] as const)(
    "asks the database for a %s",
    async (role) => {
      allow(role);
      expect(await actions.getResumeLink({ studentId })).toEqual({
        ok: true,
        data: "https://signed.example/link",
      });
      expect(rpc.getResumePath).toHaveBeenCalledWith(userId, studentId);
      expect(storage.signResumeLink).toHaveBeenCalledWith(`${studentId}/resume.pdf`);
    },
  );

  it("refuses an admin before reading anything", async () => {
    allow("admin");
    expect(await actions.getResumeLink({ studentId })).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    expect(rpc.getResumePath).not.toHaveBeenCalled();
  });

  it("signs no link when the database refuses", async () => {
    allow("student");
    rpc.getResumePath.mockResolvedValue(fail("forbidden", "You cannot view this resume."));
    expect(await actions.getResumeLink({ studentId: otherStudentId })).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    expect(storage.signResumeLink).not.toHaveBeenCalled();
  });

  it("refuses an invalid student id", async () => {
    allow("student");
    expect(await actions.getResumeLink({ studentId: "nope" })).toMatchObject({
      ok: false,
      error: { code: "validation" },
    });
    expect(await actions.getResumeLink(undefined)).toMatchObject({
      ok: false,
      error: { code: "validation" },
    });
    expect(rpc.getResumePath).not.toHaveBeenCalled();
  });
});
