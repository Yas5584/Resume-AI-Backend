import { FastifyPluginAsync } from "fastify";
import { healthRoutes } from "./health.routes.js";
import { authRoutes } from "./auth.routes.js";
import { resumeRoutes } from "./resumes.routes.js";
import { jobRoutes } from "./jobs.routes.js";
import { workflowRoutes } from "./workflows.routes.js";
import { userRoutes } from "./users.routes.js";
import { importRoutes } from "./import.routes.js";
import { matchRoutes } from "./matches.routes.js";
import { strategyRoutes } from "./strategies.routes.js";
import { contentWriterRoutes } from "./content-writer.routes.js";
import { testPdfRoutes } from "./test-pdf.routes.js";
import { webhookRoutes } from "./webhooks.routes.js";

export const apiRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(healthRoutes);
  await fastify.register(authRoutes, { prefix: "/auth" });
  await fastify.register(webhookRoutes, { prefix: "/webhooks" });
  await fastify.register(importRoutes, { prefix: "/imports" });
  await fastify.register(resumeRoutes, { prefix: "/resumes" });
  await fastify.register(jobRoutes, { prefix: "/jobs" });
  await fastify.register(matchRoutes, { prefix: "/matches" });
  await fastify.register(strategyRoutes, { prefix: "/strategies" });
  await fastify.register(contentWriterRoutes, { prefix: "/content-writer" });
  await fastify.register(workflowRoutes, { prefix: "/workflows" });
  await fastify.register(userRoutes, { prefix: "/users" });
  await fastify.register(testPdfRoutes, { prefix: "/test" });
};
