// The sign-in steps, kept free of React and Clerk imports so they can be tested
// with a fake. The real Clerk sign-in object (useSignIn) fits SignInApi.

type ApiError = { message: string; longMessage?: string; code?: string } | null;

export type SignInApi = {
  status: string;
  reset(): Promise<{ error: ApiError }>;
  password(params: {
    identifier: string;
    password: string;
  }): Promise<{ error: ApiError }>;
  sso(params: {
    strategy: "oauth_google";
    redirectUrl: string;
    redirectCallbackUrl: string;
  }): Promise<{ error: ApiError }>;
  finalize(params: {
    navigate: (args: { decorateUrl: (url: string) => string }) => void;
  }): Promise<{ error: ApiError }>;
};

export type SignInOutcome = { ok: true } | { ok: false; message: string };

export const afterSignInPath = "/after-sign-in";
export const ssoCallbackPath = "/sign-in/sso-callback";

const unsupportedStep =
  "This account needs a sign-in step that Dugtong does not support yet. Contact your coordinator.";
const wrongCredentials = "The email or password is incorrect. Check them and try again.";
const generic = "Sign-in did not work. Try again in a moment.";

// One sentence, no "Error:" prefix. Unknown accounts and wrong passwords get the
// same message so the form does not reveal which emails have accounts.
function messageFor(error: NonNullable<ApiError>): string {
  if (
    error.code === "form_identifier_not_found" ||
    error.code === "form_password_incorrect"
  ) {
    return wrongCredentials;
  }
  return error.longMessage ?? error.message ?? generic;
}

export async function signInWithPassword(
  api: SignInApi,
  values: { email: string; password: string },
  go: (url: string) => void,
): Promise<SignInOutcome> {
  const email = values.email.trim();
  if (!email || !values.password) {
    return { ok: false, message: "Enter your email and password." };
  }

  // Start clean: a leftover attempt (for example a failed password) must not
  // be reused.
  const cleared = await api.reset();
  if (cleared.error) return { ok: false, message: messageFor(cleared.error) };

  const attempt = await api.password({ identifier: email, password: values.password });
  if (attempt.error) return { ok: false, message: messageFor(attempt.error) };
  if (api.status !== "complete") return { ok: false, message: unsupportedStep };

  const finished = await api.finalize({
    navigate: ({ decorateUrl }) => go(decorateUrl(afterSignInPath)),
  });
  if (finished.error) return { ok: false, message: messageFor(finished.error) };
  return { ok: true };
}

// On success the browser leaves for Google, so there is nothing to return.
export async function signInWithGoogle(api: SignInApi): Promise<SignInOutcome> {
  // Clerk's sso() silently does nothing when a sign-in attempt is already open
  // (for example after a wrong password), so clear it first.
  const cleared = await api.reset();
  if (cleared.error) return { ok: false, message: messageFor(cleared.error) };

  const attempt = await api.sso({
    strategy: "oauth_google",
    redirectUrl: afterSignInPath,
    redirectCallbackUrl: ssoCallbackPath,
  });
  if (attempt.error) return { ok: false, message: messageFor(attempt.error) };
  return { ok: true };
}
