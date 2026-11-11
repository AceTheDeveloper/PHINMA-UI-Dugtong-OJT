import { NextResponse } from "next/server";
import {
  extractPrimaryEmail,
  verifySvixSignature,
  clerkUserUpdatedDataSchema,
  clerkUserDeletedDataSchema,
} from "@/lib/clerk/webhook";
import { clerkDeactivateUser, clerkSyncUserEmail } from "@/lib/db/rpc";

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook signing secret is not configured." },
      { status: 500 },
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Failed to read request body." }, { status: 400 });
  }

  const verification = verifySvixSignature({
    payload: rawBody,
    headers: request.headers,
    secret,
  });

  if (!verification.ok) {
    return NextResponse.json({ error: verification.error.message }, { status: 400 });
  }

  let event: { type?: string; data?: unknown };
  try {
    event = JSON.parse(rawBody) as { type?: string; data?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (event.type === "user.updated") {
    const parsed = clerkUserUpdatedDataSchema.safeParse(event.data);
    if (parsed.success) {
      const email = extractPrimaryEmail(parsed.data);
      if (email) {
        const syncResult = await clerkSyncUserEmail({
          clerkId: parsed.data.id,
          email,
        });
        if (!syncResult.ok && syncResult.error.code === "unexpected") {
          return NextResponse.json({ error: syncResult.error.message }, { status: 500 });
        }
      }
    }
  } else if (event.type === "user.deleted") {
    const parsed = clerkUserDeletedDataSchema.safeParse(event.data);
    if (parsed.success) {
      const deactivateResult = await clerkDeactivateUser({
        clerkId: parsed.data.id,
      });
      if (!deactivateResult.ok && deactivateResult.error.code === "unexpected") {
        return NextResponse.json({ error: deactivateResult.error.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
