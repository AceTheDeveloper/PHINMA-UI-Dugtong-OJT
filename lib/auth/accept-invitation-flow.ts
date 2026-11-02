import {
  afterSignInPath,
  ssoCallbackPath,
  type SignInOutcome,
} from "@/lib/auth/sign-in-flow";

// The accept-invitation steps, kept free of React and Clerk imports so they can
// be tested with a fake. The real Clerk sign-up object (useSignUp) fits
// SignUpApi. Invite-only mode in Clerk means an invitation ticket is the only
// way to create an account; after sign-up, /after-sign-in accepts the
// invitation in our own database.

type ApiError = { message: string; longMessage?: string; code?: string } | null;

export type SignUpApi = {
  status: string;
  emailAddress: string | null;
  unverifiedFields: readonly string[];
  reset(): Promise<{ error: ApiError }>;
  ticket(params: { ticket: string }): Promise<{ error: ApiError }>;
  password(params: {
    emailAddress: string;
    password: string;
  }): Promise<{ error: ApiError }>;
  sso(params: {
    strategy: "oauth_google";
    redirectUrl: string;
    redirectCallbackUrl: string;
  }): Promise<{ error: ApiError }>;
  verifications: {
    sendEmailCode(): Promise<{ error: ApiError }>;
    verifyEmailCode(params: { code: string }): Promise<{ error: ApiError }>;
  };
  finalize(params: {
    navigate: (args: { decorateUrl: (url: string) => string }) => void;
  }): Promise<{ error: ApiError }>;
};

export type StartOutcome =
  | { ok: true; email: string }
  | { ok: false; message: string };

const badInvitation =
  "This invitation link is not valid or has expired. Ask your coordinator or company supervisor for a new one.";
const unsupportedStep =
  "Your account needs a step that Dugtong does not support yet. Contact your coordinator.";
const generic = "The invitation could not be accepted. Try again in a moment.";
const wrongCode = "That code is not correct. Check it and try again.";
const expiredCode = "That code has expired. Send a new code.";
const codeFormat = "Enter the 6-digit code from your email.";

function messageFor(error: NonNullable<ApiError>): string {
  if (error.code === "form_code_incorrect") return wrongCode;
  if (error.code === "verification_expired") return expiredCode;
  return error.longMessage ?? error.message ?? generic;
}

// Starts the sign-up from the invitation link. Gives back the invited email, so
// the form can show it (read only): the account is made for that address.
export async function startInvitation(
  api: SignUpApi,
  ticket: string | null,
): Promise<StartOutcome> {
  if (!ticket || !ticket.trim()) return { ok: false, message: badInvitation };

  // Start clean: a leftover sign-up attempt must not be reused.
  const cleared = await api.reset();
  if (cleared.error) return { ok: false, message: messageFor(cleared.error) };

  const started = await api.ticket({ ticket: ticket.trim() });
  if (started.error) return { ok: false, message: badInvitation };
  if (!api.emailAddress) return { ok: false, message: badInvitation };
  return { ok: true, email: api.emailAddress };
}

async function finish(
  api: SignUpApi,
  go: (url: string) => void,
): Promise<SignInOutcome> {
  const finished = await api.finalize({
    navigate: ({ decorateUrl }) => go(decorateUrl(afterSignInPath)),
  });
  if (finished.error) return { ok: false, message: messageFor(finished.error) };
  return { ok: true };
}

// Where the sign-up stands after a step: done, needs the emailed code, or
// something this screen does not handle.
async function next(
  api: SignUpApi,
  go: (url: string) => void,
): Promise<SignInOutcome> {
  if (api.status === "complete") return finish(api, go);
  if (api.unverifiedFields.includes("email_address")) return sendCode(api);
  return { ok: false, message: unsupportedStep };
}

export async function acceptWithPassword(
  api: SignUpApi,
  password: string,
  go: (url: string) => void,
): Promise<SignInOutcome> {
  if (!password) return { ok: false, message: "Enter a password." };
  if (!api.emailAddress) return { ok: false, message: badInvitation };

  const created = await api.password({ emailAddress: api.emailAddress, password });
  if (created.error) return { ok: false, message: messageFor(created.error) };
  return next(api, go);
}

// On success the browser leaves for Google, so there is nothing to return.
export async function acceptWithGoogle(api: SignUpApi): Promise<SignInOutcome> {
  const attempt = await api.sso({
    strategy: "oauth_google",
    redirectUrl: afterSignInPath,
    redirectCallbackUrl: ssoCallbackPath,
  });
  if (attempt.error) return { ok: false, message: messageFor(attempt.error) };
  return { ok: true };
}

async function sendCode(api: SignUpApi): Promise<SignInOutcome> {
  const sent = await api.verifications.sendEmailCode();
  if (sent.error) return { ok: false, message: messageFor(sent.error) };
  return { ok: true, step: "email_code" };
}

export function resendSignUpCode(api: SignUpApi): Promise<SignInOutcome> {
  return sendCode(api);
}

// A code that is not six digits never reaches Clerk.
export async function verifySignUpCode(
  api: SignUpApi,
  code: string,
  go: (url: string) => void,
): Promise<SignInOutcome> {
  const digits = code.trim();
  if (!/^\d{6}$/.test(digits)) return { ok: false, message: codeFormat };

  const checked = await api.verifications.verifyEmailCode({ code: digits });
  if (checked.error) return { ok: false, message: messageFor(checked.error) };
  if (api.status !== "complete") return { ok: false, message: unsupportedStep };
  return finish(api, go);
}
