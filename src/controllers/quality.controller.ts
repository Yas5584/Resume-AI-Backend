import { FastifyRequest, FastifyReply } from "fastify";
import { qualityService } from "../services/quality.service.js";
import { AnalyzeResumeQualityInputSchema } from "@resumeai/shared";
import { sendSuccess } from "../utils/response.js";

export class QualityController {
  /**
   * Generates or retrieves a Resume Quality Report for a resume.
   * POST /api/resumes/:id/quality/analyze
   */
  async analyze(
    request: FastifyRequest<{
      Params: { id: string };
      Body?: unknown;
    }>,
    reply: FastifyReply,
  ) {
    const body = AnalyzeResumeQualityInputSchema.parse(request.body || {});
    const report = await qualityService.analyze(
      request.user!.id,
      request.params.id,
      body,
    );
    return sendSuccess(reply, report, 200, "Resume quality analysis completed");
  }

  /**
   * Retrieves the latest Quality Report for a resume.
   * GET /api/resumes/:id/quality
   */
  async getLatest(
    request: FastifyRequest<{
      Params: { id: string };
      Querystring: { jobId?: string };
    }>,
    reply: FastifyReply,
  ) {
    const report = await qualityService.getLatest(
      request.user!.id,
      request.params.id,
      request.query.jobId,
    );
    return sendSuccess(reply, report);
  }

  /**
   * Deletes quality reports for a resume.
   * DELETE /api/resumes/:id/quality
   */
  async delete(
    request: FastifyRequest<{
      Params: { id: string };
    }>,
    reply: FastifyReply,
  ) {
    const deleted = await qualityService.deleteByResumeId(
      request.user!.id,
      request.params.id,
    );
    return sendSuccess(
      reply,
      { deleted },
      200,
      "Resume quality reports deleted successfully",
    );
  }
}

export const qualityController = new QualityController();
