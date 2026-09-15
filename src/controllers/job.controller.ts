import { FastifyRequest, FastifyReply } from "fastify";
import { jobService } from "../services/job.service.js";
import { CreateJobRequestSchema } from "@resumeai/shared";
import { sendCreated, sendSuccess } from "../utils/response.js";
import { documentExtractionService } from "../documents/document-extractor.service.js";
import { AppError } from "../errors/index.js";

export class JobController {
  async list(
    request: FastifyRequest<{ Querystring: { page?: string; limit?: string } }>,
    reply: FastifyReply,
  ) {
    const page = parseInt(request.query.page ?? "1", 10);
    const limit = parseInt(request.query.limit ?? "20", 10);
    const result = await jobService.listJobs(request.user!.id, page, limit);
    return sendSuccess(reply, result);
  }

  async getById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const job = await jobService.getJob(request.params.id, request.user!.id);
    return sendSuccess(reply, job);
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const body = CreateJobRequestSchema.parse(request.body);
    const job = await jobService.createJob(request.user!.id, body);
    return sendCreated(reply, job);
  }

  async analyze(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const job = await jobService.analyzeJob(
      request.params.id,
      request.user!.id,
    );
    return sendSuccess(reply, job);
  }

  async upload(request: FastifyRequest, reply: FastifyReply) {
    const file = await request.file();
    if (!file) {
      throw AppError.badRequest("No file uploaded");
    }

    const buffer = await file.toBuffer();
    const mimeType = file.mimetype;
    let extractedText = "";

    if (mimeType === "application/pdf" || file.filename.endsWith(".pdf")) {
      const result = await documentExtractionService.extractPdf(buffer);
      extractedText = result.rawText;
    } else if (
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.filename.endsWith(".docx")
    ) {
      const result = await documentExtractionService.extractDocx(buffer);
      extractedText = result.rawText;
    } else if (mimeType === "text/plain" || file.filename.endsWith(".txt")) {
      extractedText = buffer.toString("utf-8");
    } else {
      throw AppError.badRequest(
        "Unsupported file format. Please upload PDF, DOCX, or TXT.",
      );
    }

    const titleField = file.fields?.title;
    const title =
      titleField && "value" in titleField
        ? (titleField as any).value
        : undefined;
    const companyField = file.fields?.company;
    const company =
      companyField && "value" in companyField
        ? (companyField as any).value
        : undefined;
    const resumeIdField = file.fields?.resumeId;
    const resumeId =
      resumeIdField && "value" in resumeIdField
        ? (resumeIdField as any).value
        : undefined;

    const job = await jobService.createJob(request.user!.id, {
      title,
      company,
      rawText: extractedText,
      resumeId,
      autoAnalyze: true,
    });

    return sendCreated(reply, job);
  }

  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const result = await jobService.deleteJob(
      request.params.id,
      request.user!.id,
    );
    return sendSuccess(reply, result);
  }
}

export const jobController = new JobController();
