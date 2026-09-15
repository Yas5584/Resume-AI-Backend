import { FastifyPluginAsync } from "fastify";
import { workflowController } from "../controllers/workflow.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

export const workflowRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", workflowController.list.bind(workflowController));
  fastify.post("/trigger", workflowController.trigger.bind(workflowController));
  fastify.get("/:id", workflowController.getById.bind(workflowController));
};
