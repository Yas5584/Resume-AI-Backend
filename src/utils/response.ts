import { FastifyReply } from "fastify";

export function sendSuccess<T>(
  reply: FastifyReply,
  data: T,
  statusCode = 200,
  message?: string,
) {
  return reply.status(statusCode).send({
    success: true,
    data,
    ...(message ? { message } : {}),
  });
}

export function sendCreated<T>(reply: FastifyReply, data: T, message?: string) {
  return sendSuccess(reply, data, 201, message);
}
