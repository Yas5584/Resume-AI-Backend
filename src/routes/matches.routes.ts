import { FastifyPluginAsync } from "fastify";
import { authenticate } from "../middleware/auth.middleware.js";
import { matchController } from "../controllers/match.controller.js";

export const matchRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", matchController.list.bind(matchController));
  fastify.post("/", matchController.create.bind(matchController));
  fastify.get("/:id", matchController.getById.bind(matchController));
  fastify.delete("/:id", matchController.delete.bind(matchController));
};
