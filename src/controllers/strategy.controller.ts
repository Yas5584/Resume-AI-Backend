import { FastifyRequest, FastifyReply } from "fastify";
import { strategyService } from "../services/strategy.service.js";
import {
  CreateStrategyRequestSchema,
  UpdateStrategyStatusRequestSchema,
} from "@resumeai/shared";
import { sendSuccess, sendCreated } from "../utils/response.js";

export class StrategyController {
  private service = strategyService;

  async createStrategy(request: FastifyRequest, reply: FastifyReply) {
    const body = CreateStrategyRequestSchema.parse(request.body);
    const result = await this.service.createStrategy(
      request.user!.id,
      body.resumeId,
      body.jobId,
      body.matchId,
    );

    return sendCreated(reply, result);
  }

  async getStrategy(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const { id } = request.params;
    const result = await this.service.getStrategy(id, request.user!.id);
    return sendSuccess(reply, result);
  }

  async updateStatus(
    request: FastifyRequest<{
      Params: { id: string };
    }>,
    reply: FastifyReply,
  ) {
    const { id } = request.params;
    const body = UpdateStrategyStatusRequestSchema.parse(request.body);

    const result = await this.service.updateStatus(
      id,
      request.user!.id,
      body.status,
    );

    return sendSuccess(reply, result);
  }

  async regenerateStrategy(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const { id } = request.params;
    const result = await this.service.regenerateStrategy(id, request.user!.id);
    return sendSuccess(reply, result);
  }

  async listStrategies(
    request: FastifyRequest<{
      Querystring: { page?: string; limit?: string };
    }>,
    reply: FastifyReply,
  ) {
    const page = Math.max(1, parseInt(request.query.page || "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(request.query.limit || "20", 10)),
    );
    const skip = (page - 1) * limit;

    const { items, total } = await this.service.listStrategies(
      request.user!.id,
      skip,
      limit,
    );

    return sendSuccess(reply, {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  }

  async deleteStrategy(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const { id } = request.params;
    await this.service.deleteStrategy(id, request.user!.id);

    return sendSuccess(reply, {
      message: "Strategy deleted successfully",
    });
  }
}

export const strategyController = new StrategyController();
