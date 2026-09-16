import "./polyfills.js";
import type { IncomingMessage, ServerResponse } from "http";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";

let appPromise: Promise<FastifyInstance> | null = null;

async function getApp(): Promise<FastifyInstance> {
  if (!appPromise) {
    appPromise = (async () => {
      const app = await buildApp();
      await app.ready();
      return app;
    })();
  }
  return appPromise;
}

/**
 * Vercel Serverless Function handler adapting Fastify's native Node.js HTTP server.
 * Reuses the compiled Fastify instance and database/Redis connections across warm invocations.
 */
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const app = await getApp();
  app.server.emit("request", req, res);
}
