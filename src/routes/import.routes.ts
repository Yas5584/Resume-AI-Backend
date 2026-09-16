import { FastifyPluginAsync } from "fastify";
import { authenticate } from "../middleware/auth.middleware.js";
import { importController } from "../controllers/import.controller.js";

export const importRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authenticate);

  fastify.post("/", importController.importResume.bind(importController));
  fastify.get("/", importController.listImports.bind(importController));
  fastify.get("/:id", importController.getImport.bind(importController));
  fastify.get("/:id/download", importController.getDownloadUrl.bind(importController));
  fastify.get("/:id/file", importController.streamFile.bind(importController));
  fastify.delete("/:id", importController.deleteImport.bind(importController));
};
