import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import type { ClerkIdentity } from "@/lib/auth/session";

// Only the invitation id is read from Clerk metadata. Role and scope never are.
const metadataSchema = z.object({ invitation_id: z.string().uuid() });

// Reads who Clerk says is signed in. Null when there is no session.
export async function getClerkIdentity(): Promise<ClerkIdentity | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  if (!user) return null;

  const primary = user.emailAddresses.find(
    (address) => address.id === user.primaryEmailAddressId,
  );
  const metadata = metadataSchema.safeParse(user.publicMetadata);
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return {
    clerkId: userId,
    email: primary?.emailAddress ?? null,
    emailVerified: primary?.verification?.status === "verified",
    fullName: name || null,
    invitationId: metadata.success ? metadata.data.invitation_id : null,
    // A verified Google account whose email is the user's primary email.
    hasGoogle: user.externalAccounts.some(
      (account) =>
        (account.provider === "google" || account.provider === "oauth_google") &&
        account.verification?.status === "verified" &&
        !!primary &&
        account.emailAddress.toLowerCase() === primary.emailAddress.toLowerCase(),
    ),
    hasPassword: user.passwordEnabled,
  };
}
