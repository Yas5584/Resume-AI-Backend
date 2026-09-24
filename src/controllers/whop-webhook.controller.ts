import { FastifyReply, FastifyRequest } from "fastify";
import { WhopPaymentProvider, WhopWebhookHeaders } from "../payments/whop.provider.js";
import { whopWebhookService } from "../services/whop-webhook.service.js";
import { env } from "../config/index.js";

export class WhopWebhookController {
  /**
   * GET /api/webhooks/whop
   * Health and readiness check for the Whop webhook endpoint.
   */
  async health(_request: FastifyRequest, reply: FastifyReply) {
    const secretConfigured = Boolean(
      (process.env.WHOP_WEBHOOK_SECRET || env.WHOP_WEBHOOK_SECRET)?.trim(),
    );
    return reply.status(200).send({
      success: true,
      data: {
        provider: "whop",
        endpoint: "/api/webhooks/whop",
        status: "ready",
        webhookSecretConfigured: secretConfigured,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * POST /api/webhooks/whop
   * Verifies the raw request body signature using HMAC-SHA256 (Standard Webhooks / Whop spec)
   * before parsing JSON and processing the event idempotently.
   */
  async handleWebhook(request: FastifyRequest, reply: FastifyReply) {
    const secret =
      process.env.WHOP_WEBHOOK_SECRET?.trim() ||
      env.WHOP_WEBHOOK_SECRET?.trim();

    if (!secret) {
      request.log.error(
        { provider: "whop" },
        "WHOP_WEBHOOK_SECRET is not configured on the server",
      );
      return reply.status(500).send({
        success: false,
        error: {
          code: "WEBHOOK_SECRET_NOT_CONFIGURED",
          message: "Webhook verification secret is not configured",
        },
      });
    }

    // 1. Extract exact raw body bytes without JSON re-serialization
    let rawBody: string | Buffer | undefined;
    if (Buffer.isBuffer(request.body)) {
      rawBody = request.body;
    } else if (typeof (request as any).rawBody === "string" || Buffer.isBuffer((request as any).rawBody)) {
      rawBody = (request as any).rawBody;
    } else if (typeof request.body === "string") {
      rawBody = request.body;
    }

    if (!rawBody || (Buffer.isBuffer(rawBody) && rawBody.length === 0) || (typeof rawBody === "string" && rawBody.length === 0)) {
      request.log.warn(
        { provider: "whop" },
        "Rejected Whop webhook: empty or non-raw request body",
      );
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_WEBHOOK_BODY",
          message: "Raw request body is required for webhook signature verification",
        },
      });
    }

    const headers = request.headers as WhopWebhookHeaders;
    const signatureHeader =
      (typeof headers["webhook-signature"] === "string"
        ? headers["webhook-signature"]
        : Array.isArray(headers["webhook-signature"])
          ? headers["webhook-signature"][0]
          : undefined) ||
      (typeof headers["x-whop-signature"] === "string"
        ? headers["x-whop-signature"]
        : Array.isArray(headers["x-whop-signature"])
          ? headers["x-whop-signature"][0]
          : "") ||
      "";

    if (!signatureHeader) {
      request.log.warn(
        {
          provider: "whop",
          webhookId: headers["webhook-id"] ?? null,
        },
        "Rejected Whop webhook: missing signature header",
      );
      return reply.status(401).send({
        success: false,
        error: {
          code: "MISSING_WEBHOOK_SIGNATURE",
          message: "Missing webhook signature header",
        },
      });
    }

    // 2. Verify HMAC-SHA256 signature against raw body
    const provider = new WhopPaymentProvider(secret);
    const isValidSignature = provider.verifyWebhookSignature(
      rawBody,
      signatureHeader,
      headers,
    );

    if (!isValidSignature) {
      request.log.warn(
        {
          provider: "whop",
          webhookId: headers["webhook-id"] ?? null,
          webhookTimestamp: headers["webhook-timestamp"] ?? null,
        },
        "Rejected Whop webhook: invalid signature or expired timestamp",
      );
      return reply.status(401).send({
        success: false,
        error: {
          code: "INVALID_WEBHOOK_SIGNATURE",
          message: "Invalid webhook signature",
        },
      });
    }

    // 3. Parse JSON payload only AFTER cryptographic verification succeeds
    const rawBodyString = Buffer.isBuffer(rawBody)
      ? rawBody.toString("utf8")
      : rawBody;

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(rawBodyString);
    } catch {
      request.log.warn(
        { provider: "whop", webhookId: headers["webhook-id"] ?? null },
        "Rejected Whop webhook: invalid JSON payload",
      );
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_JSON_PAYLOAD",
          message: "Webhook body is not valid JSON",
        },
      });
    }

    // 4. Process event idempotently via WhopWebhookService
    try {
      const result = await whopWebhookService.processWebhook(
        parsedPayload,
        headers,
      );

      request.log.info(
        {
          provider: "whop",
          eventId: result.eventId,
          eventType: result.eventType,
          duplicate: result.duplicate,
          status: result.status,
          userId: result.userId ?? null,
          subscriptionTier: result.subscriptionTier ?? null,
        },
        result.duplicate
          ? "Duplicate Whop webhook event acknowledged"
          : "Whop webhook event processed successfully",
      );

      return reply.status(200).send({
        success: true,
        data: {
          received: true,
          eventId: result.eventId,
          eventType: result.eventType,
          duplicate: result.duplicate,
          status: result.status,
        },
      });
    } catch (err: any) {
      // Distinguish between malformed payload (400) vs transient/internal failure (500)
      const isPayloadValidationError =
        err instanceof Error &&
        err.message.startsWith("Invalid Whop webhook payload");

      if (isPayloadValidationError) {
        request.log.warn(
          {
            provider: "whop",
            webhookId: headers["webhook-id"] ?? null,
            reason: err.message,
          },
          "Rejected Whop webhook due to malformed payload structure",
        );
        return reply.status(400).send({
          success: false,
          error: {
            code: "INVALID_WEBHOOK_PAYLOAD",
            message: err.message,
          },
        });
      }

      request.log.error(
        {
          provider: "whop",
          webhookId: headers["webhook-id"] ?? null,
          error: err instanceof Error ? err.message : String(err),
        },
        "Failed to process Whop webhook event",
      );

      return reply.status(500).send({
        success: false,
        error: {
          code: "WEBHOOK_PROCESSING_ERROR",
          message: "Internal error processing webhook event",
        },
      });
    }
  }
}

export const whopWebhookController = new WhopWebhookController();
