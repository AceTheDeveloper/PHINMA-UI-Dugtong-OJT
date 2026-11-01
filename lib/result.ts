// Expected failures (validation, permission, not found) are returned as typed
// results instead of thrown. Only unexpected failures throw.

export type ErrorCode =
  | "unauthenticated"
  | "not_provisioned"
  | "inactive"
  | "google_required"
  | "consent_required"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation"
  | "unexpected";

export type AppError = { code: ErrorCode; message: string };

export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function fail(code: ErrorCode, message: string): Result<never> {
  return { ok: false, error: { code, message } };
}

const databasePrefixes: Record<string, ErrorCode> = {
  forbidden: "forbidden",
  not_found: "not_found",
  conflict: "conflict",
  invalid: "validation",
};

// The write functions raise errors that start with a code word, for example
// "forbidden: only a company owner can invite ...". Anything else is
// unexpected and its text is not passed on, so internals never leak.
export function errorFromDatabase(message: string): AppError {
  const match = /^(forbidden|not_found|conflict|invalid): ([\s\S]+)$/.exec(message);
  if (match) {
    return { code: databasePrefixes[match[1]], message: match[2] };
  }
  return {
    code: "unexpected",
    message: "Something went wrong. Try again in a moment.",
  };
}
