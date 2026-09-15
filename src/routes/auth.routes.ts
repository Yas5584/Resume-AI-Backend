import { FastifyPluginAsync } from "fastify";
import { authController } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { env } from "../config/index.js";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const authRateLimitMax = env.NODE_ENV === "test" ? 1000 : 10;

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
    { preHandler: [authenticate] },
    authController.logout.bind(authController),
  );
  fastify.get(
    "/me",
    { preHandler: [authenticate] },
    authController.me.bind(authController),
  );
};
