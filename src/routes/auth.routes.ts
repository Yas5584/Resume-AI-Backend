import { FastifyPluginAsync } from "fastify";
import { authController } from "../controllers/auth.controller.js";
import { whopOAuthController } from "../controllers/whop-oauth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { env } from "../config/index.js";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const authRateLimitMax = env.NODE_ENV === "test" ? 1000 : 10;

  // Traditional Email/Password Auth
  fastify.post(
    "/register",
    {
      config: {
        rateLimit: {
          max: authRateLimitMax,
          timeWindow: "1 minute",
        },
      },
    },
    authController.register.bind(authController),
  );
  fastify.post(
    "/login",
    {
      config: {
        rateLimit: {
          max: authRateLimitMax,
          timeWindow: "1 minute",
        },
      },
    },
    authController.login.bind(authController),
  );
  fastify.post(
    "/logout",
    authController.logout.bind(authController),
  );
  fastify.get(
    "/me",
    { preHandler: [authenticate] },
    authController.me.bind(authController),
  );

  // Whop OAuth 2.1 PKCE Flow
  fastify.get(
    "/login",
    whopOAuthController.login.bind(whopOAuthController),
  );
  fastify.get(
    "/callback",
    whopOAuthController.callback.bind(whopOAuthController),
  );
  fastify.get(
    "/logout",
    whopOAuthController.logout.bind(whopOAuthController),
  );
};
