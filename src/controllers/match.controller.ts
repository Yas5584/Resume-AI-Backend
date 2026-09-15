import { FastifyRequest, FastifyReply } from "fastify";
import { matchService } from "../services/match.service.js";
import { CreateMatchRequestSchema } from "@resumeai/shared";
import { sendCreated, sendSuccess } from "../utils/response.js";

export class MatchController {
  async list(
    request: FastifyRequest<{ Querystring: { page?: string; limit?: string } }>,
    reply: FastifyReply,
  ) {
    const page = parseInt(request.query.page ?? "1", 10);
    const limit = parseInt(request.query.limit ?? "20", 10);
    const result = await matchService.listMatches(
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
    const match = await matchService.getMatch(
      request.params.id,
      request.user!.id,
    );
    return sendSuccess(reply, match);
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const body = CreateMatchRequestSchema.parse(request.body);
    const match = await matchService.createMatch(
      request.user!.id,
      body.resumeId,
      body.jobId,
    );
    return sendCreated(reply, match);
  }

  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const result = await matchService.deleteMatch(
      request.params.id,
      request.user!.id,
    );
    return sendSuccess(
      reply,
      result,
      200,
      "Match analysis deleted successfully",
    );
  }
}

export const matchController = new MatchController();
