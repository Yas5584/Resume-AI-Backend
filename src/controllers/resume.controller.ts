import { FastifyRequest, FastifyReply } from "fastify";
import { resumeService } from "../services/resume.service.js";
import { resumeExportService } from "../export/export.service.js";
import {
  CreateResumeRequestSchema,
  UpdateResumeRequestSchema,
  UpdateResumeDesignRequestSchema,
  DuplicateResumeRequestSchema,
  CreateVersionRequestSchema,
} from "@resumeai/shared";
import { sendCreated, sendSuccess } from "../utils/response.js";

export class ResumeController {
  async list(
    request: FastifyRequest<{ Querystring: { page?: string; limit?: string } }>,
    reply: FastifyReply,
  ) {
    const page = parseInt(request.query.page ?? "1", 10);
    const limit = parseInt(request.query.limit ?? "20", 10);
    const result = await resumeService.listResumes(
      request.user!.id,
      page,
      limit,
    );
    return sendSuccess(reply, result);
  }

  async getById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const resume = await resumeService.getResume(
      request.params.id,
      request.user!.id,
    );
    return sendSuccess(reply, resume);
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const body = CreateResumeRequestSchema.parse(request.body);
    const resume = await resumeService.createResume(request.user!.id, body);
    return sendCreated(reply, resume);
  }

  async update(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const body = UpdateResumeRequestSchema.parse(request.body);
    const resume = await resumeService.updateResume(
      request.params.id,
      request.user!.id,
      body,
    );
    return sendSuccess(reply, resume);
  }

  async updateDesign(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const body = UpdateResumeDesignRequestSchema.parse(request.body);
    const resume = await resumeService.updateResumeDesign(
      request.params.id,
      request.user!.id,
      body,
    );
    return sendSuccess(reply, resume);
  }

  async exportPdf(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const result = await resumeExportService.exportPdf(
      request.params.id,
      request.user!.id,
    );

    reply.header("Content-Type", result.mimeType);
    reply.header(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`,
    );
    reply.header("Content-Length", result.buffer.length);
    reply.header("Cache-Control", "no-cache, no-store, must-revalidate");

    return reply.send(result.buffer);
  }

  async exportDocx(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const result = await resumeExportService.exportDocx(
      request.params.id,
      request.user!.id,
    );

    reply.header("Content-Type", result.mimeType);
    reply.header(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`,
    );
    reply.header("Content-Length", result.buffer.length);
    reply.header("Cache-Control", "no-cache, no-store, must-revalidate");

    return reply.send(result.buffer);
  }

  async duplicate(
    request: FastifyRequest<{
      Params: { id: string };
      Body?: unknown;
    }>,
    reply: FastifyReply,
  ) {
    const body = DuplicateResumeRequestSchema.parse(request.body ?? {});
    const duplicated = await resumeService.duplicateResume(
      request.params.id,
      request.user!.id,
      body.title,
    );
    return sendCreated(reply, duplicated);
  }

  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const result = await resumeService.deleteResume(
      request.params.id,
      request.user!.id,
    );
    return sendSuccess(reply, result);
  }

  async listVersions(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const versions = await resumeService.listResumeVersions(
      request.params.id,
      request.user!.id,
    );
    return sendSuccess(reply, versions);
  }

  async createVersion(
    request: FastifyRequest<{
      Params: { id: string };
      Body?: unknown;
    }>,
    reply: FastifyReply,
  ) {
    const body = CreateVersionRequestSchema.parse(request.body ?? {});
    const version = await resumeService.createResumeVersion(
      request.params.id,
      request.user!.id,
      body.changeSummary,
    );
    return sendCreated(reply, version);
  }

  async getVersion(
    request: FastifyRequest<{ Params: { id: string; versionNumber: string } }>,
    reply: FastifyReply,
  ) {
    const versionNumber = parseInt(request.params.versionNumber, 10);
    const version = await resumeService.getResumeVersion(
      request.params.id,
      versionNumber,
      request.user!.id,
    );
    return sendSuccess(reply, version);
  }
}

export const resumeController = new ResumeController();
