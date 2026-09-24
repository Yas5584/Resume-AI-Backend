import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "crypto";
import { buildApp } from "../src/app.js";
import { FastifyInstance } from "fastify";
import { prisma } from "@resumeai/database";

const TEST_RAW_SECRET = "whop_test_signing_secret_32_bytes_key";
const TEST_WHSEC_SECRET = `whsec_${Buffer.from(TEST_RAW_SECRET, "utf8").toString("base64")}`;

function signWhopStandardWebhook(
  rawBody: string,
  webhookId: string,
  webhookTimestamp: string,
  secret = TEST_WHSEC_SECRET,
): string {
  const rawKey = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice(6), "base64")
    : Buffer.from(secret, "utf8");

  const toSign = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const digest = crypto
    .createHmac("sha256", rawKey)
    .update(toSign, "utf8")
    .digest("base64");

  return `v1,${digest}`;
}

describe("Whop Webhook Integration (POST /api/webhooks/whop)", () => {
  let app: FastifyInstance;
  const createdUserEmails: string[] = [];
  const createdEventIds: string[] = [];
  const createdMembershipIds: string[] = [];

  beforeAll(async () => {
    process.env.WHOP_WEBHOOK_SECRET = TEST_WHSEC_SECRET;
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    if (createdEventIds.length > 0) {
      await prisma.webhookEvent
        .deleteMany({
          where: { eventId: { in: createdEventIds } },
        })
        .catch(() => {});
    }
    if (createdMembershipIds.length > 0) {
      await prisma.whopSubscription
        .deleteMany({
          where: { whopMembershipId: { in: createdMembershipIds } },
        })
        .catch(() => {});
    }
    if (createdUserEmails.length > 0) {
      await prisma.user
        .deleteMany({
          where: { email: { in: createdUserEmails } },
        })
        .catch(() => {});
    }
    if (app) {
      await app.close();
    }
  });

  it("1. GET /api/webhooks/whop returns 200 readiness health check without leaking secrets", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/webhooks/whop",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.provider).toBe("whop");
    expect(body.data.endpoint).toBe("/api/webhooks/whop");
    expect(body.data.webhookSecretConfigured).toBe(true);
    expect(JSON.stringify(body)).not.toContain(TEST_RAW_SECRET);
  });

  it("2. Rejects requests with missing signature header (401)", async () => {
    const payload = JSON.stringify({
      id: `evt_missing_sig_${Date.now()}`,
      type: "membership.went_valid",
      data: { id: "mem_123" },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/webhooks/whop",
      headers: {
        "content-type": "application/json",
        "webhook-id": `msg_${Date.now()}`,
        "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
      },
      payload,
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("MISSING_WEBHOOK_SIGNATURE");
  });

  it("3. Rejects requests with invalid signature or tampered payload (401)", async () => {
    const webhookId = `msg_tamper_${Date.now()}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const originalBody = JSON.stringify({
      id: webhookId,
      type: "membership.went_valid",
      data: { id: "mem_original", email: "victim@example.com" },
    });
    const tamperedBody = JSON.stringify({
      id: webhookId,
      type: "membership.went_valid",
      data: { id: "mem_original", email: "attacker@example.com" },
    });

    const validSigForOriginal = signWhopStandardWebhook(
      originalBody,
      webhookId,
      timestamp,
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/webhooks/whop",
      headers: {
        "content-type": "application/json",
        "webhook-id": webhookId,
        "webhook-timestamp": timestamp,
        "webhook-signature": validSigForOriginal,
      },
      payload: tamperedBody,
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("INVALID_WEBHOOK_SIGNATURE");
  });

  it("4. Rejects replay attack with expired webhook-timestamp (> 5 minutes old) (401)", async () => {
    const webhookId = `msg_expired_${Date.now()}`;
    const expiredTimestamp = String(Math.floor(Date.now() / 1000) - 600); // 10 minutes ago
    const rawBody = JSON.stringify({
      id: webhookId,
      type: "membership.went_valid",
      data: { id: "mem_replay" },
    });
    const signature = signWhopStandardWebhook(
      rawBody,
      webhookId,
      expiredTimestamp,
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/webhooks/whop",
      headers: {
        "content-type": "application/json",
        "webhook-id": webhookId,
        "webhook-timestamp": expiredTimestamp,
        "webhook-signature": signature,
      },
      payload: rawBody,
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("INVALID_WEBHOOK_SIGNATURE");
  });

  it("5. Verifies exact raw body bytes (preserving custom whitespace/formatting) and upgrades user to PRO on membership.went_valid", async () => {
    const testEmail = `whop-pro-${Date.now()}@example.com`;
    createdUserEmails.push(testEmail);

    // Create a FREE user via standard registration
    const regRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: testEmail,
        name: "Whop Pro User",
        password: "Password123!",
      },
    });
    expect(regRes.statusCode).toBe(201);
    const registeredUser = regRes.json().data.user;
    expect(registeredUser.subscriptionTier).toBe("FREE");
    const initialCredits = registeredUser.creditsBalance;

    const webhookId = `msg_valid_pro_${Date.now()}`;
    const membershipId = `mem_pro_${Date.now()}`;
    const whopUserId = `user_whop_${Date.now()}`;
    createdEventIds.push(webhookId);
    createdMembershipIds.push(membershipId);

    // Deliberately include non-standard JSON whitespace/newlines to prove raw body bytes are used directly
    const formattedRawBody = `{\n  "id": "${webhookId}",\n  "type": "membership.went_valid",\n  "data": {\n    "id": "${membershipId}",\n    "user_id": "${whopUserId}",\n    "product_id": "prod_resumeai_pro",\n    "plan_id": "plan_monthly_pro",\n    "status": "active",\n    "email": "${testEmail}",\n    "metadata": {\n      "userId": "${registeredUser.id}"\n    }\n  }\n}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signWhopStandardWebhook(
      formattedRawBody,
      webhookId,
      timestamp,
    );

    const webhookRes = await app.inject({
      method: "POST",
      url: "/api/webhooks/whop",
      headers: {
        "content-type": "application/json",
        "webhook-id": webhookId,
        "webhook-timestamp": timestamp,
        "webhook-signature": signature,
      },
      payload: formattedRawBody,
    });

    expect(webhookRes.statusCode).toBe(200);
    const webhookData = webhookRes.json().data;
    expect(webhookData.received).toBe(true);
    expect(webhookData.duplicate).toBe(false);
    expect(webhookData.status).toBe("PROCESSED");

    // Verify User in DB is now PRO with active status and incremented credits
    const updatedUser = await prisma.user.findUnique({
      where: { id: registeredUser.id },
    });
    expect(updatedUser?.subscriptionTier).toBe("PRO");
    expect(updatedUser?.subscriptionStatus).toBe("active");
    expect(updatedUser?.whopUserId).toBe(whopUserId);
    expect(updatedUser?.whopMembershipId).toBe(membershipId);
    expect(updatedUser?.creditsBalance).toBe(initialCredits + 100);

    // Verify Idempotency: sending the exact same webhook event again returns 200 duplicate=true without re-incrementing credits
    const duplicateRes = await app.inject({
      method: "POST",
      url: "/api/webhooks/whop",
      headers: {
        "content-type": "application/json",
        "webhook-id": webhookId,
        "webhook-timestamp": timestamp,
        "webhook-signature": signature,
      },
      payload: formattedRawBody,
    });

    expect(duplicateRes.statusCode).toBe(200);
    expect(duplicateRes.json().data.duplicate).toBe(true);

    const userAfterDuplicate = await prisma.user.findUnique({
      where: { id: registeredUser.id },
    });
    expect(userAfterDuplicate?.creditsBalance).toBe(initialCredits + 100);
  });

  it("6. Handles payment.failed (marks past_due) and membership.went_invalid (revokes PRO back to FREE)", async () => {
    const testEmail = `whop-lifecycle-${Date.now()}@example.com`;
    createdUserEmails.push(testEmail);

    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: "Lifecycle Tester",
        passwordHash: "hash",
        subscriptionTier: "PRO",
        subscriptionStatus: "active",
        whopUserId: `user_lc_${Date.now()}`,
        whopMembershipId: `mem_lc_${Date.now()}`,
      },
    });
    createdMembershipIds.push(user.whopMembershipId!);

    // Step A: payment.failed -> subscriptionStatus becomes "past_due"
    const failEventId = `msg_fail_${Date.now()}`;
    createdEventIds.push(failEventId);
    const failPayload = JSON.stringify({
      id: failEventId,
      type: "payment.failed",
      data: {
        id: `pay_${Date.now()}`,
        user_id: user.whopUserId,
        membership_id: user.whopMembershipId,
      },
    });
    const ts1 = String(Math.floor(Date.now() / 1000));
    const sig1 = signWhopStandardWebhook(failPayload, failEventId, ts1);

    const failRes = await app.inject({
      method: "POST",
      url: "/api/webhooks/whop",
      headers: {
        "content-type": "application/json",
        "webhook-id": failEventId,
        "webhook-timestamp": ts1,
        "webhook-signature": sig1,
      },
      payload: failPayload,
    });
    expect(failRes.statusCode).toBe(200);

    const userAfterFail = await prisma.user.findUnique({
      where: { id: user.id },
    });
    expect(userAfterFail?.subscriptionStatus).toBe("past_due");

    // Step B: membership.went_invalid -> subscriptionTier downgraded to FREE and status "canceled"
    const invalidEventId = `msg_invalid_${Date.now()}`;
    createdEventIds.push(invalidEventId);
    const invalidPayload = JSON.stringify({
      id: invalidEventId,
      type: "membership.went_invalid",
      data: {
        id: user.whopMembershipId,
        user_id: user.whopUserId,
        status: "canceled",
      },
    });
    const ts2 = String(Math.floor(Date.now() / 1000));
    const sig2 = signWhopStandardWebhook(invalidPayload, invalidEventId, ts2);

    const invalidRes = await app.inject({
      method: "POST",
      url: "/api/webhooks/whop",
      headers: {
        "content-type": "application/json",
        "webhook-id": invalidEventId,
        "webhook-timestamp": ts2,
        "webhook-signature": sig2,
      },
      payload: invalidPayload,
    });
    expect(invalidRes.statusCode).toBe(200);

    const userAfterInvalid = await prisma.user.findUnique({
      where: { id: user.id },
    });
    expect(userAfterInvalid?.subscriptionTier).toBe("FREE");
    expect(userAfterInvalid?.subscriptionStatus).toBe("canceled");
  });

  it("7. Reconciles pre-registration Whop checkout automatically when the user subsequently registers with the same email", async () => {
    const preCheckoutEmail = `precheckout-${Date.now()}@example.com`;
    createdUserEmails.push(preCheckoutEmail);

    const eventId = `msg_pre_${Date.now()}`;
    const membershipId = `mem_pre_${Date.now()}`;
    const whopUserId = `user_pre_${Date.now()}`;
    createdEventIds.push(eventId);
    createdMembershipIds.push(membershipId);

    // 1. Webhook arrives BEFORE user exists in ResumeAI DB
    const rawBody = JSON.stringify({
      id: eventId,
      type: "membership.went_valid",
      data: {
        id: membershipId,
        user_id: whopUserId,
        email: preCheckoutEmail,
        status: "active",
      },
    });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = signWhopStandardWebhook(rawBody, eventId, ts);

    const webhookRes = await app.inject({
      method: "POST",
      url: "/api/webhooks/whop",
      headers: {
        "content-type": "application/json",
        "webhook-id": eventId,
        "webhook-timestamp": ts,
        "webhook-signature": sig,
      },
      payload: rawBody,
    });
    expect(webhookRes.statusCode).toBe(200);

    // 2. User now registers on ResumeAI with that email
    const regRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: preCheckoutEmail,
        name: "PreCheckout Buyer",
        password: "Password123!",
      },
    });
    expect(regRes.statusCode).toBe(201);
    const newUser = regRes.json().data.user;
    expect(newUser.subscriptionTier).toBe("PRO");
    expect(newUser.creditsBalance).toBe(110);
  });
});
