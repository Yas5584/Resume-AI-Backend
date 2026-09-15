import { FastifyRequest, FastifyReply } from "fastify";
import { contentWriterService } from "../services/content-writer.service.js";
import {
  GenerateContentProposalInputSchema,
  ApplyContentProposalInputSchema,
  UpdateChangeStatusInputSchema,
  RegenerateSectionInputSchema,
} from "@resumeai/shared";
import { sendSuccess, sendCreated } from "../utils/response.js";

export class ContentWriterController {
  private service = contentWriterService;

  async generateProposal(request: FastifyRequest, reply: FastifyReply) {
    const body = GenerateContentProposalInputSchema.parse(request.body);
    const result = await this.service.generateProposal(
      request.user!.id,
      body.resumeId,
      body.jobId,
      body.matchId,
      body.strategyId,
    );

    return sendCreated(reply, result);
  }

  async regenerateSection(request: FastifyRequest, reply: FastifyReply) {
    const body = RegenerateSectionInputSchema.parse(request.body);
    const result = await this.service.regenerateSection(request.user!.id, body);

    return sendCreated(reply, result);
  }

  async getProposal(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const { id } = request.params;
    const result = await this.service.getProposal(id, request.user!.id);
    return sendSuccess(reply, result);
  }

  async revalidateProposal(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const { id } = request.params;
    const result = await this.service.revalidateProposal(id, request.user!.id);
    return sendSuccess(reply, result);
  }

  async updateChangeStatus(
    request: FastifyRequest<{
      Params: { id: string; changeId: string };
    }>,
    reply: FastifyReply,
  ) {
    const { id, changeId } = request.params;
    const body = UpdateChangeStatusInputSchema.parse(request.body);

    const result = await this.service.updateChangeStatus(
      id,
      request.user!.id,
      changeId,
      body.status,
    );

    return sendSuccess(reply, result);
  }

  async applyProposal(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const { id } = request.params;
    const body = ApplyContentProposalInputSchema.parse(request.body || {});

    const result = await this.service.applyProposal(
      id,
      request.user!.id,
      body.selectedChangeIds,
    );

    return sendSuccess(reply, result);
  }

  async rejectProposal(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const { id } = request.params;
    const result = await this.service.rejectProposal(id, request.user!.id);
    return sendSuccess(reply, result);
  }

  async deleteProposal(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const { id } = request.params;
    const result = await this.service.deleteProposal(id, request.user!.id);
    return sendSuccess(reply, result);
  }
}

export const contentWriterController = new ContentWriterController();
