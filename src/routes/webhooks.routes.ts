import { FastifyPluginAsync } from "fastify";
import { whopWebhookController } from "../controllers/whop-webhook.controller.js";

/**
 * Encapsulated webhook routes plugin (`/api/webhooks/*`).
 * Uses a scoped raw-buffer content-type parser so webhook endpoints receive
 * the exact unparsed byte stream required for HMAC-SHA256 signature verification,
 * without affecting JSON parsing on any other API routes.
 */
export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.removeContentTypeParser("application/json");
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (_req, body, done) => {
      done(null, body);
    },
  );

  fastify.get(
    "/whop",
    whopWebhookController.health.bind(whopWebhookController),
  );

  fastify.post(
    "/whop",
    whopWebhookController.handleWebhook.bind(whopWebhookController),
  );
};
