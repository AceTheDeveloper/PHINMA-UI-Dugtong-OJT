import { describe, expect, it, vi } from "vitest";
import {
  acceptWithGoogle,
  acceptWithPassword,
  resendSignUpCode,
  startInvitation,
  verifySignUpCode,
  type SignUpApi,
} from "@/lib/auth/accept-invitation-flow";

function fakeApi(overrides: Partial<SignUpApi> = {}) {
  const api = {
    status: "complete",
    emailAddress: "ana@example.test",
    unverifiedFields: [] as readonly string[],
    reset: vi.fn<SignUpApi["reset"]>().mockResolvedValue({ error: null }),
    ticket: vi.fn<SignUpApi["ticket"]>().mockResolvedValue({ error: null }),
    password: vi.fn<SignUpApi["password"]>().mockResolvedValue({ error: null }),
    sso: vi.fn<SignUpApi["sso"]>().mockResolvedValue({ error: null }),
    verifications: {
      sendEmailCode: vi.fn<SignUpApi["verifications"]["sendEmailCode"]>().mockResolvedValue({ error: null }),
      verifyEmailCode: vi.fn<SignUpApi["verifications"]["verifyEmailCode"]>().mockResolvedValue({ error: null }),
    },
    finalize: vi.fn<SignUpApi["finalize"]>(async ({ navigate }) => {
      navigate({ decorateUrl: (url) => `${url}?decorated` });
      return { error: null };
    }),
    ...overrides,
  } satisfies SignUpApi;
  return api;
}

const badInvitation =
  "This invitation link is not valid or has expired. Ask your coordinator or company supervisor for a new one.";

describe("startInvitation", () => {
  it("starts from the ticket and gives back the invited email", async () => {
    const api = fakeApi();
    expect(await startInvitation(api, " ticket-123 ")).toEqual({
      ok: true,
      email: "ana@example.test",
    });
    expect(api.ticket).toHaveBeenCalledWith({ ticket: "ticket-123" });
  });

  it("clears a leftover sign-up before it starts", async () => {
    const api = fakeApi();
    await startInvitation(api, "ticket-123");
    expect(vi.mocked(api.reset).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(api.ticket).mock.invocationCallOrder[0],
    );
  });

  it.each([null, "", "   "])("never calls Clerk without a ticket (%j)", async (ticket) => {
    const api = fakeApi();
    expect(await startInvitation(api, ticket)).toEqual({ ok: false, message: badInvitation });
    expect(api.reset).not.toHaveBeenCalled();
    expect(api.ticket).not.toHaveBeenCalled();
  });

  it("gives one sentence for a used, expired, or revoked invitation", async () => {
    const api = fakeApi({
      ticket: vi.fn().mockResolvedValue({ error: { message: "Ticket invalid", code: "ticket_invalid" } }),
    });
    expect(await startInvitation(api, "ticket-123")).toEqual({ ok: false, message: badInvitation });
  });

  it("refuses an invitation that comes back without an email", async () => {
    const api = fakeApi({ emailAddress: null });
    expect(await startInvitation(api, "ticket-123")).toEqual({ ok: false, message: badInvitation });
  });

  it("stops with a message if the leftover attempt cannot be cleared", async () => {
    const api = fakeApi({
      reset: vi.fn().mockResolvedValue({ error: { message: "Could not reset." } }),
    });
    expect(await startInvitation(api, "ticket-123")).toEqual({ ok: false, message: "Could not reset." });
    expect(api.ticket).not.toHaveBeenCalled();
  });
});

describe("acceptWithPassword", () => {
  it("creates the account for the invited email, finalizes, and goes to the post-sign-in router", async () => {
    const api = fakeApi();
    const go = vi.fn();
    expect(await acceptWithPassword(api, "a strong password", go)).toEqual({ ok: true });
    expect(api.password).toHaveBeenCalledWith({
      emailAddress: "ana@example.test",
      password: "a strong password",
    });
    expect(go).toHaveBeenCalledWith("/after-sign-in?decorated");
  });

  it("does not call Clerk with an empty password", async () => {
    const api = fakeApi();
    const go = vi.fn();
    expect(await acceptWithPassword(api, "", go)).toEqual({ ok: false, message: "Enter a password." });
    expect(api.password).not.toHaveBeenCalled();
    expect(go).not.toHaveBeenCalled();
  });

  it("does not call Clerk when the invited email is missing", async () => {
    const api = fakeApi({ emailAddress: null });
    expect(await acceptWithPassword(api, "a strong password", vi.fn())).toEqual({
      ok: false,
      message: badInvitation,
    });
    expect(api.password).not.toHaveBeenCalled();
  });

  it("shows Clerk's message for a weak or breached password and signs nobody in", async () => {
    const api = fakeApi({
      password: vi.fn().mockResolvedValue({
        error: { message: "Weak", longMessage: "That password has been found in a data breach. Use a different one." },
      }),
    });
    const go = vi.fn();
    expect(await acceptWithPassword(api, "password1", go)).toEqual({
      ok: false,
      message: "That password has been found in a data breach. Use a different one.",
    });
    expect(api.finalize).not.toHaveBeenCalled();
    expect(go).not.toHaveBeenCalled();
  });

  it("asks for the emailed code when Clerk needs the email verified", async () => {
    const api = fakeApi({ status: "missing_requirements", unverifiedFields: ["email_address"] });
    const go = vi.fn();
    expect(await acceptWithPassword(api, "a strong password", go)).toEqual({
      ok: true,
      step: "email_code",
    });
    expect(api.verifications.sendEmailCode).toHaveBeenCalledTimes(1);
    expect(api.finalize).not.toHaveBeenCalled();
    expect(go).not.toHaveBeenCalled();
  });

  it("refuses any other unfinished sign-up instead of getting stuck", async () => {
    const api = fakeApi({ status: "missing_requirements" });
    const go = vi.fn();
    expect(await acceptWithPassword(api, "a strong password", go)).toMatchObject({ ok: false });
    expect(api.finalize).not.toHaveBeenCalled();
    expect(go).not.toHaveBeenCalled();
  });

  it("reports a failure to finalize the session", async () => {
    const api = fakeApi({
      finalize: vi.fn().mockResolvedValue({ error: { message: "Session could not start." } }),
    });
    const go = vi.fn();
    expect(await acceptWithPassword(api, "a strong password", go)).toEqual({
      ok: false,
      message: "Session could not start.",
    });
    expect(go).not.toHaveBeenCalled();
  });
});

describe("acceptWithGoogle", () => {
  it("starts Google with the callback and the post-sign-in router", async () => {
    const api = fakeApi();
    expect(await acceptWithGoogle(api)).toEqual({ ok: true });
    expect(api.sso).toHaveBeenCalledWith({
      strategy: "oauth_google",
      redirectUrl: "/after-sign-in",
      redirectCallbackUrl: "/sign-in/sso-callback",
    });
  });

  it("reports a failure to start", async () => {
    const api = fakeApi({
      sso: vi.fn().mockResolvedValue({ error: { message: "Google is not available." } }),
    });
    expect(await acceptWithGoogle(api)).toEqual({ ok: false, message: "Google is not available." });
  });
});

describe("verifySignUpCode", () => {
  it("checks the code, finalizes, and goes to the post-sign-in router", async () => {
    const api = fakeApi();
    const go = vi.fn();
    expect(await verifySignUpCode(api, " 123456 ", go)).toEqual({ ok: true });
    expect(api.verifications.verifyEmailCode).toHaveBeenCalledWith({ code: "123456" });
    expect(go).toHaveBeenCalledWith("/after-sign-in?decorated");
  });

  it.each(["", "12345", "1234567", "12345a", "12 456"])("never sends %j to Clerk", async (code) => {
    const api = fakeApi();
    expect(await verifySignUpCode(api, code, vi.fn())).toEqual({
      ok: false,
      message: "Enter the 6-digit code from your email.",
    });
    expect(api.verifications.verifyEmailCode).not.toHaveBeenCalled();
  });

  it("says a wrong or expired code is wrong or expired and signs nobody in", async () => {
    for (const [code, message] of [
      ["form_code_incorrect", "That code is not correct. Check it and try again."],
      ["verification_expired", "That code has expired. Send a new code."],
    ] as const) {
      const api = fakeApi({
        verifications: {
          sendEmailCode: vi.fn(),
          verifyEmailCode: vi.fn().mockResolvedValue({ error: { message: "x", code } }),
        },
      });
      const go = vi.fn();
      expect(await verifySignUpCode(api, "123456", go)).toEqual({ ok: false, message });
      expect(api.finalize).not.toHaveBeenCalled();
      expect(go).not.toHaveBeenCalled();
    }
  });

  it("does not sign in when the sign-up is still not complete after the code", async () => {
    const api = fakeApi({ status: "missing_requirements" });
    const go = vi.fn();
    expect(await verifySignUpCode(api, "123456", go)).toMatchObject({ ok: false });
    expect(api.finalize).not.toHaveBeenCalled();
    expect(go).not.toHaveBeenCalled();
  });
});

describe("resendSignUpCode", () => {
  it("sends a new code", async () => {
    const api = fakeApi();
    expect(await resendSignUpCode(api)).toEqual({ ok: true, step: "email_code" });
    expect(api.verifications.sendEmailCode).toHaveBeenCalledTimes(1);
  });

  it("reports a resend failure", async () => {
    const api = fakeApi({
      verifications: {
        sendEmailCode: vi.fn().mockResolvedValue({ error: { message: "Could not send." } }),
        verifyEmailCode: vi.fn(),
      },
    });
    expect(await resendSignUpCode(api)).toEqual({ ok: false, message: "Could not send." });
  });
});
