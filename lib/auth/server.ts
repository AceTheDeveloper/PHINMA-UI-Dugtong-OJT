import "server-only";
import { notFound, redirect } from "next/navigation";
import { authorizeWith, type AuthorizeOptions } from "@/lib/auth/authorize";
import { getClerkIdentity } from "@/lib/auth/clerk";
import type { Role } from "@/lib/auth/roles";
import { redirectFor } from "@/lib/auth/routes";
import type { Session } from "@/lib/auth/session";
import { databaseSessionStore } from "@/lib/db/rpc";
import type { Result } from "@/lib/result";

// For server actions and route handlers: returns a typed result.
export async function authorize(
  allowed: readonly Role[],
  options: AuthorizeOptions = {},
): Promise<Result<Session>> {
  return authorizeWith(
    await getClerkIdentity(),
    databaseSessionStore,
    allowed,
    options,
  );
}

// For pages and layouts: returns the session, or sends the visitor where they
// belong (sign-in, no access, deactivated, consent) or shows not found.
export async function requireRole(
  allowed: readonly Role[],
  options: AuthorizeOptions = {},
): Promise<Session> {
  const result = await authorize(allowed, options);
  if (result.ok) return result.data;
  const destination = redirectFor(result.error.code);
  if (destination) redirect(destination);
  if (result.error.code === "forbidden") notFound();
  throw new Error(result.error.message);
}
