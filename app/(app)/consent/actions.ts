"use server";

import { redirect } from "next/navigation";
import { roleHome, roles } from "@/lib/auth/roles";
import { redirectFor } from "@/lib/auth/routes";
import { authorize } from "@/lib/auth/server";
import { getConsentNoticeVersion, recordConsent } from "@/lib/db/rpc";

// Records that the signed-in person accepted the current privacy notice, then
// sends them to their home. The notice version comes from the database, never
// from the browser.
export async function acceptConsent(): Promise<void> {
  const result = await authorize(roles, { requireConsent: false });
  if (!result.ok) {
    redirect(redirectFor(result.error.code) ?? "/sign-in");
  }

  const version = await getConsentNoticeVersion();
  if (!version.ok) throw new Error(version.error.message);

  const recorded = await recordConsent(result.data.userId, version.data);
  if (!recorded.ok) {
    // The notice changed while the page was open: show it again.
    if (recorded.error.code === "conflict") redirect("/consent");
    throw new Error(recorded.error.message);
  }
  redirect(roleHome(result.data.role));
}
