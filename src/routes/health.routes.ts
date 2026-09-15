import { FastifyPluginAsync } from "fastify";
import { healthController } from "../controllers/health.controller.js";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/health", healthController.checkHealth.bind(healthController));
};
