import { redirect } from "next/navigation";
import { roleHome, roles } from "@/lib/auth/roles";
import { redirectFor } from "@/lib/auth/routes";
import { authorize } from "@/lib/auth/server";

// Where Clerk sends people after sign-in or sign-up. It creates the account on
// the first visit, then routes: no access, deactivated, consent, or role home.
export default async function AfterSignInPage() {
  const result = await authorize(roles, { requireConsent: false });
  if (!result.ok) {
    redirect(redirectFor(result.error.code) ?? "/no-access");
  }
  if (!result.data.hasConsent) {
    redirect("/consent");
  }
  redirect(roleHome(result.data.role));
}
