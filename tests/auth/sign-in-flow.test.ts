import { describe, expect, it, vi } from "vitest";
import {
  signInWithGoogle,
  signInWithPassword,
  type SignInApi,
} from "@/lib/auth/sign-in-flow";

function fakeApi(overrides: Partial<SignInApi> = {}) {
  const api = {
    status: "complete",
    reset: vi.fn<SignInApi["reset"]>().mockResolvedValue({ error: null }),
    password: vi.fn<SignInApi["password"]>().mockResolvedValue({ error: null }),
    sso: vi.fn<SignInApi["sso"]>().mockResolvedValue({ error: null }),
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
