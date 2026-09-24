import crypto from "crypto";
import {
  PaymentProvider,
  CheckoutSessionOptions,
  CheckoutSessionResult,
  WebhookEventPayload,
} from "./payment.interface.js";
import { env } from "../config/index.js";

export interface WhopWebhookHeaders {
  "webhook-id"?: string;
  "webhook-timestamp"?: string;
  "webhook-signature"?: string;
  "x-whop-signature"?: string;
  [key: string]: string | string[] | undefined;
}

export interface NormalizedWhopWebhookEvent extends WebhookEventPayload {
  eventId: string;
  eventType: string;
  userId?: string;
  whopUserId?: string;
  whopMembershipId?: string;
  whopProductId?: string;
  whopPlanId?: string;
  email?: string;
  status?: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  data: Record<string, unknown>;
}

const DEFAULT_TIMESTAMP_TOLERANCE_SECONDS = 300; // 5 minutes

function getHeaderString(
  headers: WhopWebhookHeaders | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(direct)) return direct[0];
  return typeof direct === "string" ? direct.trim() : undefined;
}

/**
 * Derives candidate HMAC secret key buffers from a configured Whop secret.
 * Supports:
 * 1. Standard Webhooks base64-encoded secrets with `whsec_` or `ws_` prefix
 * 2. Raw UTF-8 secret strings (with or without prefix)
 */
function deriveSecretBuffers(secret: string): Buffer[] {
  const trimmed = secret.trim();
  const stripped = trimmed.startsWith("whsec_")
    ? trimmed.slice(6)
    : trimmed.startsWith("ws_")
      ? trimmed.slice(3)
      : trimmed;

  const candidates: Buffer[] = [];
  // Candidate 1: Base64 decoded stripped secret (Standard Webhooks / Svix spec)
  try {
    const b64 = Buffer.from(stripped, "base64");
    if (b64.length > 0) {
      candidates.push(b64);
    }
  } catch {
    // ignore
  }
  // Candidate 2: UTF-8 bytes of stripped secret
  candidates.push(Buffer.from(stripped, "utf8"));
  // Candidate 3: UTF-8 bytes of full secret (including prefix if any)
  if (stripped !== trimmed) {
    candidates.push(Buffer.from(trimmed, "utf8"));
  }
  return candidates;
}

function safeCompareBuffers(a: Buffer, b: Buffer): boolean {
  if (a.length === 0 || a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

export class WhopPaymentProvider implements PaymentProvider {
  readonly providerName = "whop" as const;
  private readonly webhookSecret?: string;

  constructor(webhookSecret?: string) {
    this.webhookSecret = webhookSecret ?? env.WHOP_WEBHOOK_SECRET;
  }

  async createCheckoutSession(
    options: CheckoutSessionOptions,
  ): Promise<CheckoutSessionResult> {
    const checkoutBaseUrl = "https://whop.com/checkout";
    const params = new URLSearchParams({
      email: options.userEmail,
      "d[user_id]": options.userId,
      redirect_url: options.successUrl,
    });
    return {
      sessionId: `whop_chk_${crypto.randomUUID()}`,
      checkoutUrl: `${checkoutBaseUrl}?${params.toString()}`,
    };
  }

  /**
   * Verifies a Whop webhook signature against the exact raw request body.
   * Supports both Standard Webhooks headers (`webhook-id`, `webhook-timestamp`, `webhook-signature`)
   * and direct signature verification.
   */
  verifyWebhookSignature(
    rawBody: string | Buffer,
    signatureOrHeader: string,
    headers?: WhopWebhookHeaders,
    toleranceSeconds = DEFAULT_TIMESTAMP_TOLERANCE_SECONDS,
  ): boolean {
    const secret = this.webhookSecret ?? env.WHOP_WEBHOOK_SECRET;
    if (!secret || secret.trim().length === 0) {
      return false;
    }

    const rawString = Buffer.isBuffer(rawBody)
      ? rawBody.toString("utf8")
      : rawBody;
    if (typeof rawString !== "string" || rawString.length === 0) {
      return false;
    }

    const webhookId = getHeaderString(headers, "webhook-id");
    const webhookTimestamp = getHeaderString(headers, "webhook-timestamp");
    const sigHeader =
      signatureOrHeader ||
      getHeaderString(headers, "webhook-signature") ||
      getHeaderString(headers, "x-whop-signature") ||
      "";

    if (!sigHeader.trim()) {
      return false;
    }

    // If timestamp header is provided, enforce replay protection
    if (webhookTimestamp !== undefined) {
      const ts = Number(webhookTimestamp);
      if (!Number.isFinite(ts) || ts <= 0) {
        return false;
      }
      if (toleranceSeconds > 0) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (Math.abs(nowSeconds - ts) > toleranceSeconds) {
          return false;
        }
      }
    }

    // Extract signature entries (space-separated for secret rotation, e.g. "v1,sig1 v1,sig2")
    const rawEntries = sigHeader
      .trim()
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const extractedSignatures: string[] = [];
    for (const entry of rawEntries) {
      if (entry.includes(",")) {
        const parts = entry.split(",");
        const version = parts[0]?.trim();
        const sigValue = parts.slice(1).join(",").trim();
        // Only accept v1 or sha256 version tags
        if ((version === "v1" || version === "sha256") && sigValue) {
          extractedSignatures.push(sigValue);
        }
      } else if (entry.startsWith("sha256=")) {
        extractedSignatures.push(entry.slice(7));
      } else {
        extractedSignatures.push(entry);
      }
    }

    if (extractedSignatures.length === 0) {
      return false;
    }

    // Signing payloads to verify:
    // 1. Standard Webhooks canonical payload: `${webhookId}.${webhookTimestamp}.${rawString}`
    // 2. Direct raw body payload (when webhook-id / webhook-timestamp are absent or v1 direct HMAC)
    const signingPayloads: string[] = [];
    if (webhookId && webhookTimestamp) {
      signingPayloads.push(`${webhookId}.${webhookTimestamp}.${rawString}`);
    } else {
      signingPayloads.push(rawString);
    }

    const secretBuffers = deriveSecretBuffers(secret);

    for (const payloadToSign of signingPayloads) {
      for (const secretBuf of secretBuffers) {
        const hmacBase64 = crypto
          .createHmac("sha256", secretBuf)
          .update(payloadToSign, "utf8")
          .digest("base64");
        const hmacHex = crypto
          .createHmac("sha256", secretBuf)
          .update(payloadToSign, "utf8")
          .digest("hex");

        const expectedBase64Buf = Buffer.from(hmacBase64, "base64");
        const expectedHexBuf = Buffer.from(hmacHex, "hex");

        for (const providedSig of extractedSignatures) {
          // Check base64 match
          try {
            const providedBase64Buf = Buffer.from(providedSig, "base64");
            if (safeCompareBuffers(providedBase64Buf, expectedBase64Buf)) {
              return true;
            }
          } catch {
            // ignore malformed base64
          }
          // Check hex match
          if (/^[0-9a-fA-F]{64}$/.test(providedSig)) {
            try {
              const providedHexBuf = Buffer.from(providedSig, "hex");
              if (safeCompareBuffers(providedHexBuf, expectedHexBuf)) {
                return true;
              }
            } catch {
              // ignore
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * Parses and normalizes a verified Whop webhook JSON payload into a canonical structure.
   */
  parseWebhookEvent(
    payload: unknown,
    headers?: WhopWebhookHeaders,
  ): NormalizedWhopWebhookEvent {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Invalid Whop webhook payload: expected JSON object");
    }

    const root = payload as Record<string, unknown>;
    const rawType =
      (typeof root.type === "string" && root.type) ||
      (typeof root.action === "string" && root.action) ||
      (typeof root.event === "string" && root.event) ||
      "";

    const eventType = rawType.trim();
    if (!eventType) {
      throw new Error("Invalid Whop webhook payload: missing event type/action");
    }

    const dataObj =
      root.data && typeof root.data === "object" && !Array.isArray(root.data)
        ? (root.data as Record<string, unknown>)
        : root;

    const headerEventId = getHeaderString(headers, "webhook-id");
    const rootId =
      (typeof root.id === "string" && root.id.trim()) ||
      (typeof root.webhook_id === "string" && root.webhook_id.trim()) ||
      headerEventId ||
      "";

    if (!rootId) {
      throw new Error("Invalid Whop webhook payload: missing event ID");
    }

    // Extract metadata / custom fields for ResumeAI internal user ID mapping
    const metadata =
      (dataObj.metadata && typeof dataObj.metadata === "object"
        ? (dataObj.metadata as Record<string, unknown>)
        : undefined) ??
      (dataObj.custom_fields && typeof dataObj.custom_fields === "object"
        ? (dataObj.custom_fields as Record<string, unknown>)
        : undefined) ??
      {};

    const userObj =
      dataObj.user && typeof dataObj.user === "object"
        ? (dataObj.user as Record<string, unknown>)
        : undefined;

    const memberObj =
      dataObj.member && typeof dataObj.member === "object"
        ? (dataObj.member as Record<string, unknown>)
        : undefined;

    // Internal ResumeAI userId (if passed in checkout metadata / custom_fields / client_reference_id)
    const resumeAiUserId =
      (typeof metadata.userId === "string" && metadata.userId.trim()) ||
      (typeof metadata.user_id === "string" && metadata.user_id.trim()) ||
      (typeof metadata.resumeai_user_id === "string" &&
        metadata.resumeai_user_id.trim()) ||
      (typeof dataObj.client_reference_id === "string" &&
        dataObj.client_reference_id.trim()) ||
      undefined;

    // Whop's external user ID (e.g., "user_xxxxxx")
    const whopUserId =
      (typeof dataObj.user_id === "string" && dataObj.user_id.trim()) ||
      (typeof userObj?.id === "string" && userObj.id.trim()) ||
      (typeof memberObj?.user_id === "string" && memberObj.user_id.trim()) ||
      undefined;

    // Whop membership / subscription ID (e.g., "mem_xxxxxx")
    const whopMembershipId =
      (typeof dataObj.membership_id === "string" &&
        dataObj.membership_id.trim()) ||
      (eventType.startsWith("membership.") &&
      typeof dataObj.id === "string" &&
      dataObj.id.trim()
        ? dataObj.id.trim()
        : undefined) ||
      (typeof dataObj.subscription_id === "string" &&
        dataObj.subscription_id.trim()) ||
      undefined;

    // Product and Plan IDs
    const whopProductId =
      (typeof dataObj.product_id === "string" && dataObj.product_id.trim()) ||
      (dataObj.product &&
      typeof dataObj.product === "object" &&
      typeof (dataObj.product as Record<string, unknown>).id === "string"
        ? ((dataObj.product as Record<string, unknown>).id as string).trim()
        : undefined);

    const whopPlanId =
      (typeof dataObj.plan_id === "string" && dataObj.plan_id.trim()) ||
      (dataObj.plan &&
      typeof dataObj.plan === "object" &&
      typeof (dataObj.plan as Record<string, unknown>).id === "string"
        ? ((dataObj.plan as Record<string, unknown>).id as string).trim()
        : undefined);

    // Email extraction
    const rawEmail =
      (typeof dataObj.email === "string" && dataObj.email) ||
      (typeof dataObj.user_email === "string" && dataObj.user_email) ||
      (typeof userObj?.email === "string" && userObj.email) ||
      (typeof memberObj?.email === "string" && memberObj.email) ||
      (typeof metadata.email === "string" && metadata.email) ||
      undefined;

    const email = rawEmail ? rawEmail.toLowerCase().trim() : undefined;

    const status =
      typeof dataObj.status === "string" ? dataObj.status.trim() : undefined;

    const cancelAtPeriodEnd =
      typeof dataObj.cancel_at_period_end === "boolean"
        ? dataObj.cancel_at_period_end
        : undefined;

    const parseDate = (val: unknown): Date | undefined => {
      if (!val) return undefined;
      if (typeof val === "number") {
        // Handle unix epoch seconds vs ms
        const ms = val < 1e12 ? val * 1000 : val;
        const d = new Date(ms);
        return isNaN(d.getTime()) ? undefined : d;
      }
      if (typeof val === "string") {
        const num = Number(val);
        if (Number.isFinite(num) && /^\d+$/.test(val.trim())) {
          const ms = num < 1e12 ? num * 1000 : num;
          const d = new Date(ms);
          return isNaN(d.getTime()) ? undefined : d;
        }
        const d = new Date(val);
        return isNaN(d.getTime()) ? undefined : d;
      }
      return undefined;
    };

    const currentPeriodStart = parseDate(
      dataObj.renewal_period_start ??
        dataObj.current_period_start ??
        dataObj.valid_from,
    );
    const currentPeriodEnd = parseDate(
      dataObj.renewal_period_end ??
        dataObj.current_period_end ??
        dataObj.expires_at ??
        dataObj.valid_until,
    );

    return {
      eventId: rootId,
      eventType,
      userId: resumeAiUserId,
      whopUserId,
      whopMembershipId,
      whopProductId,
      whopPlanId,
      email,
      status,
      cancelAtPeriodEnd,
      currentPeriodStart,
      currentPeriodEnd,
      data: dataObj,
    };
  }
}

export const whopPaymentProvider = new WhopPaymentProvider();
