import { FastifyRequest, FastifyReply } from "fastify";
import { healthService } from "../services/health.service.js";

export class HealthController {
  async checkHealth(_request: FastifyRequest, reply: FastifyReply) {
    const health = healthService.getHealth();
    return reply.status(200).send(health);
  }
}

export const healthController = new HealthController();
