import { FastifyRequest, FastifyReply } from "fastify";
import { workflowService } from "../services/workflow.service.js";
import { TriggerWorkflowRequestSchema } from "@resumeai/shared";
import { sendCreated, sendSuccess } from "../utils/response.js";

export class WorkflowController {
  async list(
    request: FastifyRequest<{ Querystring: { page?: string; limit?: string } }>,
    reply: FastifyReply,
  ) {
    const page = parseInt(request.query.page ?? "1", 10);
    const limit = parseInt(request.query.limit ?? "20", 10);
    const result = await workflowService.listWorkflows(
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
    const run = await workflowService.getWorkflow(
      request.params.id,
      request.user!.id,
    );
    return sendSuccess(reply, run);
  }

  async trigger(request: FastifyRequest, reply: FastifyReply) {
    const body = TriggerWorkflowRequestSchema.parse(request.body);
    const result = await workflowService.triggerWorkflow(
      request.user!.id,
      body,
    );
    return sendCreated(reply, result);
  }
}

export const workflowController = new WorkflowController();
