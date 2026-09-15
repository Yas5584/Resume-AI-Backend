import { FastifyRequest, FastifyReply } from "fastify";
import { resumeImportService } from "../services/import.service.js";
import { AppError } from "../errors/index.js";

export class ImportController {
  async importResume(request: FastifyRequest, reply: FastifyReply) {
    const file = await request.file();

    if (!file) {
      throw AppError.badRequest("No file uploaded.");
    }

    const buffer = await file.toBuffer();

    const titleField = file.fields?.title;
    const title =
      titleField && "value" in titleField
        ? (titleField as any).value
        : undefined;

    const targetRoleField = file.fields?.targetRole;
    const targetRole =
      targetRoleField && "value" in targetRoleField
        ? (targetRoleField as any).value
        : undefined;

    const result = await resumeImportService.processImport(
      request.user!.id,
      buffer,
      {
        filename: file.filename,
        mimeType: file.mimetype,
        title,
        targetRole,
      },
    );

    return reply.status(201).send({ success: true, data: result });
  }

  async getImport(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const importRecord = await resumeImportService.getImport(
      request.params.id,
      request.user!.id,
    );

    if (!importRecord) {
      throw AppError.notFound("Import");
    }

    return reply.status(200).send({ success: true, data: importRecord });
  }

  async listImports(
    request: FastifyRequest<{
      Querystring: { page?: string; limit?: string };
    }>,
    reply: FastifyReply,
  ) {
    const page = request.query.page ? parseInt(request.query.page, 10) : 1;
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : 10;

    const result = await resumeImportService.listImports(
      request.user!.id,
      page,
      limit,
    );
    return reply.status(200).send({ success: true, data: result });
  }
}

export const importController = new ImportController();
