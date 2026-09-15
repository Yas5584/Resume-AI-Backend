import { FastifyPluginAsync } from "fastify";
import { authenticate } from "../middleware/auth.middleware.js";
import { contentWriterController } from "../controllers/content-writer.controller.js";

export const contentWriterRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authenticate);

  fastify.post(
    "/generate",
    contentWriterController.generateProposal.bind(contentWriterController),
  );
  fastify.post(
    "/regenerate-section",
    contentWriterController.regenerateSection.bind(contentWriterController),
  );
  fastify.get(
    "/proposals/:id",
    contentWriterController.getProposal.bind(contentWriterController),
  );
  fastify.post(
    "/proposals/:id/revalidate",
    contentWriterController.revalidateProposal.bind(contentWriterController),
  );
  fastify.post(
    "/proposals/:id/apply",
    contentWriterController.applyProposal.bind(contentWriterController),
  );
  fastify.post(
    "/proposals/:id/reject",
    contentWriterController.rejectProposal.bind(contentWriterController),
  );
  fastify.patch(
    "/proposals/:id/changes/:changeId",
    contentWriterController.updateChangeStatus.bind(contentWriterController),
  );
  fastify.delete(
    "/proposals/:id",
    contentWriterController.deleteProposal.bind(contentWriterController),
  );
};
