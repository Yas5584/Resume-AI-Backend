import { FastifyPluginAsync } from "fastify";
import { authenticate } from "../middleware/auth.middleware.js";
import { importController } from "../controllers/import.controller.js";

export const importRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authenticate);

  fastify.post("/", importController.importResume.bind(importController));
  fastify.get("/", importController.listImports.bind(importController));
  fastify.get("/:id", importController.getImport.bind(importController));
};
