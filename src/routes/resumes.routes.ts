import { FastifyPluginAsync } from "fastify";
import { resumeController } from "../controllers/resume.controller.js";
import { qualityController } from "../controllers/quality.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

export const resumeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", resumeController.list.bind(resumeController));
  fastify.post("/", resumeController.create.bind(resumeController));
  fastify.get("/:id", resumeController.getById.bind(resumeController));
  fastify.patch("/:id", resumeController.update.bind(resumeController));
  fastify.put("/:id", resumeController.update.bind(resumeController));
  fastify.patch(
    "/:id/design",
    resumeController.updateDesign.bind(resumeController),
  );
  fastify.put(
    "/:id/design",
    resumeController.updateDesign.bind(resumeController),
  );
  fastify.get(
    "/:id/export/pdf",
    resumeController.exportPdf.bind(resumeController),
  );
  fastify.get(
    "/:id/export/docx",
    resumeController.exportDocx.bind(resumeController),
  );
  fastify.delete("/:id", resumeController.delete.bind(resumeController));
  fastify.post(
    "/:id/duplicate",
    resumeController.duplicate.bind(resumeController),
  );
  fastify.get(
    "/:id/versions",
    resumeController.listVersions.bind(resumeController),
  );
  fastify.post(
    "/:id/versions",
    resumeController.createVersion.bind(resumeController),
  );
  fastify.get(
    "/:id/versions/:versionNumber",
    resumeController.getVersion.bind(resumeController),
  );

  // Phase 10: Resume Quality & ATS Readiness Analyzer
  fastify.post(
    "/:id/quality/analyze",
    qualityController.analyze.bind(qualityController),
  );
  fastify.get(
    "/:id/quality",
    qualityController.getLatest.bind(qualityController),
  );
  fastify.delete(
    "/:id/quality",
    qualityController.delete.bind(qualityController),
  );
};

