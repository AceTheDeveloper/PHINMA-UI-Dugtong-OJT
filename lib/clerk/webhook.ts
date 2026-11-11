import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { fail, ok, type Result } from "@/lib/result";

// 5 minutes tolerance for timestamp drift to prevent replay attacks
const SIGNATURE_TOLERANCE_SECONDS = 300;

export const clerkEmailAddressSchema = z.object({
  id: z.string(),
  email_address: z.string(),
});

export const clerkUserUpdatedDataSchema = z.object({
  id: z.string().min(1),
  email_addresses: z.array(clerkEmailAddressSchema).default([]),
  primary_email_address_id: z.string().nullable().optional(),
});

export const clerkUserDeletedDataSchema = z.object({
  id: z.string().min(1),
  deleted: z.boolean().optional(),
});

export const clerkWebhookEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("user.updated"),
    data: clerkUserUpdatedDataSchema,
  }),
  z.object({
    type: z.literal("user.deleted"),
    data: clerkUserDeletedDataSchema,
  }),
]);

export type ClerkWebhookEvent =
  | z.infer<typeof clerkWebhookEventSchema>
  | { type: string; data: Record<string, unknown> };

export function extractPrimaryEmail(data: z.infer<typeof clerkUserUpdatedDataSchema>): string | null {
  if (data.primary_email_address_id) {
    const match = data.email_addresses.find((e) => e.id === data.primary_email_address_id);
    if (match?.email_address) return match.email_address;
  }
  return data.email_addresses[0]?.email_address ?? null;
}

export function verifySvixSignature(input: {
  payload: string;
  headers: Headers | Record<string, string | null | undefined>;
  secret: string;
  nowSeconds?: number;
}): Result<void> {
  const getHeader = (name: string): string | null => {
    if (input.headers instanceof Headers) {
      return input.headers.get(name);
    }
    return input.headers[name] ?? input.headers[name.toLowerCase()] ?? null;
  };

  const svixId = getHeader("svix-id");
  const svixTimestamp = getHeader("svix-timestamp");
  const svixSignature = getHeader("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return fail("unauthenticated", "Missing svix headers.");
  }

  const timestampNum = parseInt(svixTimestamp, 10);
  if (Number.isNaN(timestampNum)) {
    return fail("unauthenticated", "Invalid svix timestamp.");
  }

  const currentSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(currentSeconds - timestampNum) > SIGNATURE_TOLERANCE_SECONDS) {
    return fail("unauthenticated", "Webhook signature timestamp is outside tolerance.");
  }

  const cleanSecret = input.secret.startsWith("whsec_")
    ? input.secret.slice("whsec_".length)
    : input.secret;

  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(cleanSecret, "base64");
  } catch {
    return fail("unexpected", "Webhook signing secret is not valid base64.");
  }

  const toSign = `${svixId}.${svixTimestamp}.${input.payload}`;
  const computedSignature = createHmac("sha256", secretBytes)
    .update(toSign)
    .digest("base64");

  const expectedSignatureBuffer = Buffer.from(computedSignature);

  // svix-signature header contains space-delimited signatures, e.g. "v1,abc v1,xyz"
  const signatures = svixSignature.split(" ");
  let matched = false;

  for (const sig of signatures) {
    const parts = sig.split(",");
    if (parts.length < 2) continue;
    const version = parts[0];
    const signatureValue = parts.slice(1).join(",");
    if (version !== "v1") continue;

    const signatureBuffer = Buffer.from(signatureValue);
    if (
      signatureBuffer.length === expectedSignatureBuffer.length &&
      timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
    ) {
      matched = true;
      break;
    }
  }

  if (!matched) {
    return fail("unauthenticated", "Invalid webhook signature.");
  }

  return ok(undefined);
}
