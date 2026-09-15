import { FastifyPluginAsync } from "fastify";
import { jobController } from "../controllers/job.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

export const jobRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", jobController.list.bind(jobController));
  fastify.post("/", jobController.create.bind(jobController));
  fastify.post("/upload", jobController.upload.bind(jobController));
  fastify.get("/:id", jobController.getById.bind(jobController));
  fastify.post("/:id/analyze", jobController.analyze.bind(jobController));
  fastify.delete("/:id", jobController.delete.bind(jobController));
};
