import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { ErrorCode, ErrorCodeType } from "@resumeai/shared";
import { env } from "../config/index.js";
import { AUTH_COOKIE_NAME } from "../utils/cookies.js";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCodeType;
  public readonly details?: unknown;

  constructor(
    statusCode: number,
    code: ErrorCodeType,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, ErrorCode.BAD_REQUEST, message, details);
  }

  static validation(message: string, details?: unknown) {
    return new AppError(400, ErrorCode.VALIDATION_ERROR, message, details);
  }

  static unauthorized(message = "Unauthorized") {
    return new AppError(401, ErrorCode.UNAUTHORIZED, message);
  }

  static forbidden(message = "Access denied: You do not own this resource") {
    return new AppError(403, ErrorCode.FORBIDDEN, message);
  }

  static notFound(resource = "Resource") {
    return new AppError(404, ErrorCode.NOT_FOUND, `${resource} not found`);
  }

  static conflict(message: string) {
    return new AppError(409, ErrorCode.CONFLICT, message);
  }

  static internal(message = "Internal server error") {
    return new AppError(500, ErrorCode.INTERNAL_SERVER_ERROR, message);
  }
}

export function errorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  request.log.error(error);

  // AppError (Custom application exceptions)
  if (error instanceof AppError) {
    if (
      error.statusCode === 401 &&
      request.cookies &&
      request.cookies[AUTH_COOKIE_NAME]
    ) {
      reply.clearCookie(AUTH_COOKIE_NAME, {
        path: "/",
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
      });
    }

    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details ?? null,
      },
    });
  }

  // Zod Validation Error
  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: "Request validation failed",
        details: error.flatten().fieldErrors,
      },
    });
  }

  // Fastify Schema Validation Error
  if ("validation" in error && error.validation) {
    return reply.status(400).send({
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: error.message,
        details: error.validation,
      },
    });
  }

  // Rate Limiting
  if ("statusCode" in error && error.statusCode === 429) {
    return reply.status(429).send({
      success: false,
      error: {
        code: ErrorCode.RATE_LIMITED,
        message: "Too many requests. Please try again later.",
      },
    });
  }

  // Generic Unhandled Server Error
  const isProduction = env.NODE_ENV === "production";
  const statusCode =
    "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : 500;

  return reply.status(statusCode).send({
    success: false,
    error: {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: isProduction
        ? "An unexpected internal error occurred"
        : error.message,
    },
  });
}
