// Creates the first admin invitation. Run once, before any admin exists:
//   npm run bootstrap:admin -- you@example.com
// Later admins are invited from inside the app by an existing admin.
// Needs .env.local (see .env.example). Uses the service role, so run it only on
// a machine you trust.
import { createClerkClient } from "@clerk/backend";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const lifetimeDays = 7;

const env = z
  .object({
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    CLERK_SECRET_KEY: z.string().min(1),
  })
  .safeParse(process.env);
if (!env.success) {
  console.error(
    "Missing or invalid environment variables:",
    env.error.issues.map((issue) => issue.path.join(".")).join(", "),
  );
  process.exit(1);
}

const email = z.string().email().safeParse(process.argv[2]?.trim().toLowerCase());
if (!email.success) {
  console.error("Usage: npm run bootstrap:admin -- you@example.com");
  process.exit(1);
}

const supabase = createClient(
  env.data.NEXT_PUBLIC_SUPABASE_URL,
  env.data.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const clerk = createClerkClient({ secretKey: env.data.CLERK_SECRET_KEY });

const admins = await supabase
  .from("users")
  .select("id", { count: "exact", head: true })
  .eq("role", "admin");
if (admins.error) {
  console.error("Could not check for existing admins:", admins.error.message);
  process.exit(1);
}
if ((admins.count ?? 0) > 0) {
  console.error(
    "An admin already exists. Ask an existing admin to invite you from inside the app.",
  );
  process.exit(1);
}

const row = await supabase
  .from("invitations")
  .insert({
    email: email.data,
    role: "admin",
    status: "pending",
    expires_at: new Date(Date.now() + lifetimeDays * 24 * 60 * 60 * 1000).toISOString(),
  })
  .select("id")
  .single();
if (row.error || !row.data) {
  console.error("Could not create the invitation:", row.error?.message ?? "no row");
  process.exit(1);
}
const invitationId = z.string().uuid().parse(row.data.id);

try {
  const invitation = await clerk.invitations.createInvitation({
    emailAddress: email.data,
    publicMetadata: { invitation_id: invitationId },
    redirectUrl: `${env.data.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/accept-invitation`,
    expiresInDays: lifetimeDays,
  });
  const attached = await supabase
    .from("invitations")
    .update({ clerk_invitation_id: invitation.id })
    .eq("id", invitationId);
  if (attached.error) throw new Error(attached.error.message);
} catch (error) {
  await supabase.from("invitations").update({ status: "revoked" }).eq("id", invitationId);
  console.error(
    "Could not send the Clerk invitation:",
    error instanceof Error ? error.message : "unknown error",
  );
  process.exit(1);
}

console.log(`Invitation sent to ${email.data}. It expires in ${lifetimeDays} days.`);
console.log("Open the email, then accept with the Google account for that address.");
