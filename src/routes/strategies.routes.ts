import { FastifyPluginAsync } from "fastify";
import { authenticate } from "../middleware/auth.middleware.js";
import { strategyController } from "../controllers/strategy.controller.js";

export const strategyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authenticate);

  fastify.post("/", strategyController.createStrategy.bind(strategyController));
  fastify.get("/", strategyController.listStrategies.bind(strategyController));
  fastify.get("/:id", strategyController.getStrategy.bind(strategyController));
  fastify.patch(
    "/:id/status",
    strategyController.updateStatus.bind(strategyController),
  );
  fastify.post(
    "/:id/regenerate",
    strategyController.regenerateStrategy.bind(strategyController),
  );
  fastify.post(
    "/:id/reanalyze",
    strategyController.regenerateStrategy.bind(strategyController),
  );
  fastify.delete(
    "/:id",
    strategyController.deleteStrategy.bind(strategyController),
  );
};
