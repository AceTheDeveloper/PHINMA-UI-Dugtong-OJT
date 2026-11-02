import { describe, expect, it, vi } from "vitest";
import {
  cancelSignIn,
  resendSignInCode,
  signInWithGoogle,
  signInWithPassword,
  verifySignInCode,
  type SignInApi,
} from "@/lib/auth/sign-in-flow";

function fakeApi(overrides: Partial<SignInApi> = {}) {
  const api = {
    status: "complete",
    reset: vi.fn<SignInApi["reset"]>().mockResolvedValue({ error: null }),
    password: vi.fn<SignInApi["password"]>().mockResolvedValue({ error: null }),
    sso: vi.fn<SignInApi["sso"]>().mockResolvedValue({ error: null }),
    mfa: {
      sendEmailCode: vi.fn<SignInApi["mfa"]["sendEmailCode"]>().mockResolvedValue({ error: null }),
      verifyEmailCode: vi.fn<SignInApi["mfa"]["verifyEmailCode"]>().mockResolvedValue({ error: null }),
    },
    finalize: vi.fn<SignInApi["finalize"]>(async ({ navigate }) => {
      navigate({ decorateUrl: (url) => `${url}?decorated` });
      return { error: null };
    }),
    ...overrides,
  } satisfies SignInApi;
  return api;
}

const values = { email: "  ana@example.test ", password: "correct horse" };

describe("signInWithPassword", () => {
  it("signs in, finalizes the session, and goes to the post-sign-in router", async () => {
    const api = fakeApi();
    const go = vi.fn();
    const outcome = await signInWithPassword(api, values, go);
    expect(outcome).toEqual({ ok: true });
    expect(api.password).toHaveBeenCalledWith({
      identifier: "ana@example.test",
      password: "correct horse",
    });
    expect(go).toHaveBeenCalledWith("/after-sign-in?decorated");
  });

  it("does not call Clerk when the email or password is empty", async () => {
    const api = fakeApi();
    const go = vi.fn();
    for (const empty of [
      { email: "", password: "x" },
      { email: "   ", password: "x" },
      { email: "ana@example.test", password: "" },
    ]) {
      expect(await signInWithPassword(api, empty, go)).toEqual({
        ok: false,
        message: "Enter your email and password.",
      });
    }
    expect(api.password).not.toHaveBeenCalled();
    expect(go).not.toHaveBeenCalled();
  });

  it.each(["form_identifier_not_found", "form_password_incorrect"])(
    "gives %s the same message so the form does not reveal which emails exist",
    async (code) => {
      const api = fakeApi({
        password: vi.fn().mockResolvedValue({
          error: { message: "Couldn't find your account.", code },
        }),
      });
      const go = vi.fn();
      const outcome = await signInWithPassword(api, values, go);
      expect(outcome).toEqual({
        ok: false,
        message: "The email or password is incorrect. Check them and try again.",
      });
      expect(api.finalize).not.toHaveBeenCalled();
      expect(go).not.toHaveBeenCalled();
    },
  );

  it("shows Clerk's own message for any other error", async () => {
    const api = fakeApi({
      password: vi.fn().mockResolvedValue({
        error: { message: "Too many requests.", longMessage: "Too many requests. Try again in a minute.", code: "too_many_requests" },
      }),
    });
    const outcome = await signInWithPassword(api, values, vi.fn());
    expect(outcome).toEqual({ ok: false, message: "Too many requests. Try again in a minute." });
  });

  it("refuses an account that needs an extra step instead of getting stuck", async () => {
    const api = fakeApi({ status: "needs_second_factor" });
    const go = vi.fn();
    const outcome = await signInWithPassword(api, values, go);
    expect(outcome).toMatchObject({ ok: false });
    expect(api.finalize).not.toHaveBeenCalled();
    expect(go).not.toHaveBeenCalled();
  });

  it("reports a failure to finalize the session", async () => {
    const api = fakeApi({
      finalize: vi.fn().mockResolvedValue({ error: { message: "Session could not start." } }),
    });
    const go = vi.fn();
    const outcome = await signInWithPassword(api, values, go);
    expect(outcome).toEqual({ ok: false, message: "Session could not start." });
    expect(go).not.toHaveBeenCalled();
  });
});

describe("a leftover sign-in attempt", () => {
  it("is cleared before a password sign-in", async () => {
    const api = fakeApi();
    await signInWithPassword(api, values, vi.fn());
    expect(vi.mocked(api.reset).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(api.password).mock.invocationCallOrder[0],
    );
  });

  it("is cleared before Google starts, so Google still opens after a wrong password", async () => {
    const api = fakeApi();
    await signInWithGoogle(api);
    expect(api.reset).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.reset).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(api.sso).mock.invocationCallOrder[0],
    );
  });

  it("stops with a message if it cannot be cleared", async () => {
    const api = fakeApi({
      reset: vi.fn().mockResolvedValue({ error: { message: "Could not reset." } }),
    });
    expect(await signInWithGoogle(api)).toEqual({ ok: false, message: "Could not reset." });
    expect(await signInWithPassword(api, values, vi.fn())).toEqual({
      ok: false,
      message: "Could not reset.",
    });
    expect(api.sso).not.toHaveBeenCalled();
    expect(api.password).not.toHaveBeenCalled();
  });
});

describe("signInWithGoogle", () => {
  it("starts Google sign-in with the callback and the post-sign-in router", async () => {
    const api = fakeApi();
    expect(await signInWithGoogle(api)).toEqual({ ok: true });
    expect(api.sso).toHaveBeenCalledWith({
      strategy: "oauth_google",
      redirectUrl: "/after-sign-in",
      redirectCallbackUrl: "/sign-in/sso-callback",
    });
  });

  it("reports an error from Clerk", async () => {
    const api = fakeApi({
      sso: vi.fn().mockResolvedValue({ error: { message: "Google is unavailable." } }),
    });
    expect(await signInWithGoogle(api)).toEqual({ ok: false, message: "Google is unavailable." });
  });
});

describe("a sign-in from a new device (needs_client_trust)", () => {
  it("emails a code and asks for the code step instead of failing", async () => {
    const api = fakeApi({ status: "needs_client_trust" });
    const go = vi.fn();
    const outcome = await signInWithPassword(api, values, go);
    expect(outcome).toEqual({ ok: true, step: "email_code" });
    expect(api.mfa.sendEmailCode).toHaveBeenCalledTimes(1);
    expect(api.finalize).not.toHaveBeenCalled();
    expect(go).not.toHaveBeenCalled();
  });

  it("stops with a message if the code cannot be sent", async () => {
    const api = fakeApi({
      status: "needs_client_trust",
      mfa: {
        sendEmailCode: vi.fn().mockResolvedValue({
          error: { message: "Too many requests.", longMessage: "Too many requests. Try again in a minute." },
        }),
        verifyEmailCode: vi.fn(),
      },
    });
    expect(await signInWithPassword(api, values, vi.fn())).toEqual({
      ok: false,
      message: "Too many requests. Try again in a minute.",
    });
  });

  it("does not send a code for any other unsupported status", async () => {
    const api = fakeApi({ status: "needs_second_factor" });
    await signInWithPassword(api, values, vi.fn());
    expect(api.mfa.sendEmailCode).not.toHaveBeenCalled();
  });
});

describe("verifySignInCode", () => {
  it("checks the code, finalizes the session, and goes to the post-sign-in router", async () => {
    const api = fakeApi();
    const go = vi.fn();
    expect(await verifySignInCode(api, " 123456 ", go)).toEqual({ ok: true });
    expect(api.mfa.verifyEmailCode).toHaveBeenCalledWith({ code: "123456" });
    expect(go).toHaveBeenCalledWith("/after-sign-in?decorated");
  });

  it.each(["", "12345", "1234567", "12345a", "abcdef", "12 456"])(
    "never sends %j to Clerk",
    async (code) => {
      const api = fakeApi();
      const go = vi.fn();
      expect(await verifySignInCode(api, code, go)).toEqual({
        ok: false,
        message: "Enter the 6-digit code from your email.",
      });
      expect(api.mfa.verifyEmailCode).not.toHaveBeenCalled();
      expect(go).not.toHaveBeenCalled();
    },
  );

  it("says a wrong code is wrong and does not sign in", async () => {
    const api = fakeApi({
      mfa: {
        sendEmailCode: vi.fn(),
        verifyEmailCode: vi.fn().mockResolvedValue({
          error: { message: "Incorrect code", code: "form_code_incorrect" },
        }),
      },
    });
    const go = vi.fn();
    expect(await verifySignInCode(api, "123456", go)).toEqual({
      ok: false,
      message: "That code is not correct. Check it and try again.",
    });
    expect(api.finalize).not.toHaveBeenCalled();
    expect(go).not.toHaveBeenCalled();
  });

  it("says an expired code is expired", async () => {
    const api = fakeApi({
      mfa: {
        sendEmailCode: vi.fn(),
        verifyEmailCode: vi.fn().mockResolvedValue({
          error: { message: "Expired", code: "verification_expired" },
        }),
      },
    });
    expect(await verifySignInCode(api, "123456", vi.fn())).toEqual({
      ok: false,
      message: "That code has expired. Send a new code.",
    });
  });

  it("does not sign in when the status is still not complete after the code", async () => {
    const api = fakeApi({ status: "needs_client_trust" });
    const go = vi.fn();
    expect(await verifySignInCode(api, "123456", go)).toMatchObject({ ok: false });
    expect(api.finalize).not.toHaveBeenCalled();
    expect(go).not.toHaveBeenCalled();
  });

  it("reports a failure to finalize the session", async () => {
    const api = fakeApi({
      finalize: vi.fn().mockResolvedValue({ error: { message: "Session could not start." } }),
    });
    const go = vi.fn();
    expect(await verifySignInCode(api, "123456", go)).toEqual({
      ok: false,
      message: "Session could not start.",
    });
    expect(go).not.toHaveBeenCalled();
  });
});

describe("resendSignInCode and cancelSignIn", () => {
  it("sends a new code", async () => {
    const api = fakeApi();
    expect(await resendSignInCode(api)).toEqual({ ok: true, step: "email_code" });
    expect(api.mfa.sendEmailCode).toHaveBeenCalledTimes(1);
  });

  it("reports a resend failure", async () => {
    const api = fakeApi({
      mfa: {
        sendEmailCode: vi.fn().mockResolvedValue({ error: { message: "Could not send." } }),
        verifyEmailCode: vi.fn(),
      },
    });
    expect(await resendSignInCode(api)).toEqual({ ok: false, message: "Could not send." });
  });

  it("clears the attempt so the next sign-in starts clean", async () => {
    const api = fakeApi();
    expect(await cancelSignIn(api)).toEqual({ ok: true });
    expect(api.reset).toHaveBeenCalledTimes(1);
  });

  it("reports a failure to clear the attempt", async () => {
    const api = fakeApi({
      reset: vi.fn().mockResolvedValue({ error: { message: "Could not reset." } }),
    });
    expect(await cancelSignIn(api)).toEqual({ ok: false, message: "Could not reset." });
  });
});
