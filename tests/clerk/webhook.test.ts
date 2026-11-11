import { createHmac } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  extractPrimaryEmail,
  verifySvixSignature,
} from "@/lib/clerk/webhook";
import { POST } from "@/app/api/webhooks/clerk/route";
import * as rpc from "@/lib/db/rpc";
import { ok } from "@/lib/result";

const TEST_SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";

function makeSignatureHeaders(payload: string, secret = TEST_SECRET, timestamp?: string) {
  const cleanSecret = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const secretBytes = Buffer.from(cleanSecret, "base64");
  const svixId = "msg_test_12345";
  const svixTimestamp = timestamp ?? Math.floor(Date.now() / 1000).toString();
  const toSign = `${svixId}.${svixTimestamp}.${payload}`;
  const sig = createHmac("sha256", secretBytes).update(toSign).digest("base64");
  return {
    "svix-id": svixId,
    "svix-timestamp": svixTimestamp,
    "svix-signature": `v1,${sig}`,
  };
}

describe("verifySvixSignature", () => {
  it("verifies a valid signature", () => {
    const payload = JSON.stringify({ type: "user.updated" });
    const headers = makeSignatureHeaders(payload);
    const result = verifySvixSignature({
      payload,
      headers,
      secret: TEST_SECRET,
    });
    expect(result.ok).toBe(true);
  });

  it("handles space-delimited signatures where one matches", () => {
    const payload = JSON.stringify({ type: "user.updated" });
    const validHeaders = makeSignatureHeaders(payload);
    const multiHeaders = {
      ...validHeaders,
      "svix-signature": `v1,invalidSig123 ${validHeaders["svix-signature"]}`,
    };
    const result = verifySvixSignature({
      payload,
      headers: multiHeaders,
      secret: TEST_SECRET,
    });
    expect(result.ok).toBe(true);
  });

  it("fails when headers are missing", () => {
    const payload = JSON.stringify({ type: "user.updated" });
    const result = verifySvixSignature({
      payload,
      headers: {},
      secret: TEST_SECRET,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("Missing svix headers");
    }
  });

  it("fails when signature is invalid", () => {
    const payload = JSON.stringify({ type: "user.updated" });
    const headers = {
      "svix-id": "msg_test",
      "svix-timestamp": Math.floor(Date.now() / 1000).toString(),
      "svix-signature": "v1,badSignatureValue",
    };
    const result = verifySvixSignature({
      payload,
      headers,
      secret: TEST_SECRET,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("Invalid webhook signature");
    }
  });

  it("fails when timestamp is outside tolerance (older than 5 minutes)", () => {
    const payload = JSON.stringify({ type: "user.updated" });
    const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString();
    const headers = makeSignatureHeaders(payload, TEST_SECRET, oldTimestamp);
    const result = verifySvixSignature({
      payload,
      headers,
      secret: TEST_SECRET,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("timestamp is outside tolerance");
    }
  });
});

describe("extractPrimaryEmail", () => {
  it("extracts matching primary email when primary_email_address_id is provided", () => {
    const email = extractPrimaryEmail({
      id: "user_1",
      email_addresses: [
        { id: "email_1", email_address: "secondary@example.test" },
        { id: "email_2", email_address: "primary@example.test" },
      ],
      primary_email_address_id: "email_2",
    });
    expect(email).toBe("primary@example.test");
  });

  it("falls back to first email when primary_email_address_id is not found", () => {
    const email = extractPrimaryEmail({
      id: "user_1",
      email_addresses: [
        { id: "email_1", email_address: "first@example.test" },
      ],
      primary_email_address_id: "nonexistent",
    });
    expect(email).toBe("first@example.test");
  });

  it("returns null when email_addresses is empty", () => {
    const email = extractPrimaryEmail({
      id: "user_1",
      email_addresses: [],
    });
    expect(email).toBeNull();
  });
});

describe("POST /api/webhooks/clerk", () => {
  const originalSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

  beforeEach(() => {
    process.env.CLERK_WEBHOOK_SIGNING_SECRET = TEST_SECRET;
    vi.restoreAllMocks();
  });

  afterAll(() => {
    process.env.CLERK_WEBHOOK_SIGNING_SECRET = originalSecret;
  });

  it("returns 500 when CLERK_WEBHOOK_SIGNING_SECRET is not configured", async () => {
    delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;
    const req = new Request("http://localhost/api/webhooks/clerk", {
      method: "POST",
      body: JSON.stringify({ type: "user.updated" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain("Webhook signing secret is not configured");
  });

  it("returns 400 when signature is invalid or missing", async () => {
    const req = new Request("http://localhost/api/webhooks/clerk", {
      method: "POST",
      body: JSON.stringify({ type: "user.updated" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("processes user.updated event and calls clerkSyncUserEmail", async () => {
    const syncSpy = vi.spyOn(rpc, "clerkSyncUserEmail").mockResolvedValue(ok(null));

    const payload = JSON.stringify({
      type: "user.updated",
      data: {
        id: "user_clerk_123",
        email_addresses: [
          { id: "e1", email_address: "updated@example.test" },
        ],
        primary_email_address_id: "e1",
      },
    });

    const headers = makeSignatureHeaders(payload);
    const req = new Request("http://localhost/api/webhooks/clerk", {
      method: "POST",
      headers,
      body: payload,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);

    expect(syncSpy).toHaveBeenCalledWith({
      clerkId: "user_clerk_123",
      email: "updated@example.test",
    });
  });

  it("processes user.deleted event and calls clerkDeactivateUser", async () => {
    const deactivateSpy = vi.spyOn(rpc, "clerkDeactivateUser").mockResolvedValue(ok(null));

    const payload = JSON.stringify({
      type: "user.deleted",
      data: {
        id: "user_clerk_deleted_999",
        deleted: true,
      },
    });

    const headers = makeSignatureHeaders(payload);
    const req = new Request("http://localhost/api/webhooks/clerk", {
      method: "POST",
      headers,
      body: payload,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);

    expect(deactivateSpy).toHaveBeenCalledWith({
      clerkId: "user_clerk_deleted_999",
    });
  });

  it("returns 200 acknowledged for unhandled event types", async () => {
    const payload = JSON.stringify({
      type: "session.created",
      data: { id: "sess_123" },
    });

    const headers = makeSignatureHeaders(payload);
    const req = new Request("http://localhost/api/webhooks/clerk", {
      method: "POST",
      headers,
      body: payload,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);
  });
});
