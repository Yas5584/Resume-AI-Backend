import "./polyfills.js";
import fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import { Redis } from "ioredis";
import { env } from "./config/index.js";
import { errorHandler } from "./errors/index.js";
import { loggerConfig } from "./utils/logger.js";
import { apiRoutes } from "./routes/index.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: env.NODE_ENV !== "test" ? loggerConfig : false,
    disableRequestLogging: env.NODE_ENV === "test",
    trustProxy: true,
  });

  // Centralized Error Handler
  app.setErrorHandler(errorHandler);

  // Security Plugins
  await app.register(sensible);
  await app.register(cookie, {
    secret: env.COOKIE_SECRET,
    hook: "onRequest",
  });
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB
      files: 1,
    },
  });
  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === "production",
    crossOriginEmbedderPolicy: false,
  });

  // Parse allowed origins list
  const configuredOrigins = env.API_CORS_ORIGIN
    ? env.API_CORS_ORIGIN.split(",").map((o) => o.trim())
    : [];

  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return cb(null, true);

      const allowedOrigins = [
        ...configuredOrigins,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
      ];

      if (
        allowedOrigins.includes(origin) ||
        (process.env.NODE_ENV !== "production" &&
          /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) ||
        /^https:\/\/([a-zA-Z0-9_-]+\.)*vercel\.app$/.test(origin)
      ) {
        return cb(null, true);
      }
      return cb(new Error("CORS not allowed"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cookie",
      "webhook-id",
      "webhook-timestamp",
      "webhook-signature",
      "x-whop-signature",
    ],
  });

  // Rate Limiting (Default: 100 requests per minute per IP, relaxed in test environment)
  // In production/serverless, use Redis store if configured so limits synchronize across instances
  const isTest = process.env.NODE_ENV === "test" || env.NODE_ENV === "test";
  const isProd = process.env.NODE_ENV === "production" || env.NODE_ENV === "production";

  const rateLimitOptions: Record<string, any> = {
    max: isTest ? 100000 : 100,
    timeWindow: "1 minute",
  };

  if (isProd && env.REDIS_URL) {
    try {
      const redis =
        (globalThis as any).apiRateLimitRedis ??
        new Redis(env.REDIS_URL, {
          lazyConnect: true,
          connectTimeout: 2000,
          maxRetriesPerRequest: 1,
          retryStrategy: () => null,
        });
      (globalThis as any).apiRateLimitRedis = redis;
      rateLimitOptions.redis = redis;
    } catch {
      // Fallback cleanly to in-memory store if Redis is unreachable
    }
  }

  await app.register(rateLimit, rateLimitOptions);

  // Friendly root route for Vercel / browser health checks
  app.get("/", async () => {
    return {
      name: "ResumeAI Backend API",
      status: "ok",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
    };
  });

  // Favicon handler to avoid spurious 404s
  app.get("/favicon.ico", async (_, reply) => {
    return reply.status(204).send();
  });

  // Root Health Check for Railway / Cloud Load Balancers
  app.get("/health", async () => {
    return {
      status: "ok",
      service: "resumeai-api",
      timestamp: new Date().toISOString(),
    };
  });

  // Register API Routes
  await app.register(apiRoutes, { prefix: "/api" });

  return app;
}
