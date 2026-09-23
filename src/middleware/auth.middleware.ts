import { FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import { env } from "../config/index.js";
import { AppError } from "../errors/index.js";
import { AuthenticatedRequestUser } from "@resumeai/shared";
import { AUTH_COOKIE_NAME } from "../utils/cookies.js";
import { userRepository } from "../repositories/user.repository.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedRequestUser;
  }
}

interface JwtPayload {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  sessionId?: string;
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  let token: string | undefined;

  // 1. Check HttpOnly cookie first (Primary authentication channel)
  if (request.cookies && request.cookies[AUTH_COOKIE_NAME]) {
    token = request.cookies[AUTH_COOKIE_NAME];
  }

  // 2. Fallback to Authorization: Bearer <token> (API-only clients, scripts, tests)
  if (!token) {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
  }

  if (token) {
    token = token.trim();
    if (token.startsWith('"') && token.endsWith('"')) {
      token = token.slice(1, -1);
    }
    if (token.startsWith("Bearer ")) {
      token = token.substring(7).trim();
    }
  }

  if (!token) {
    throw AppError.unauthorized("Authentication required");
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // 3. Ensure token carries a valid sessionId and validate against active database session
    if (!decoded.sessionId) {
      throw AppError.unauthorized("Invalid token format: missing session ID");
    }

    try {
      const activeSession = await userRepository.findSessionByToken(
        decoded.sessionId,
      );

      if (!activeSession) {
        throw AppError.unauthorized("Session has been revoked or expired");
      }

      if (new Date(activeSession.expiresAt) < new Date()) {
        await userRepository
          .deleteSessionByToken(decoded.sessionId)
          .catch(() => {});
        throw AppError.unauthorized("Session has expired");
      }
    } catch (sessionErr: any) {
      if (sessionErr instanceof AppError) {
        throw sessionErr;
      }
      request.log.warn(
        { err: sessionErr },
        "Session DB lookup failed due to transient connection error, falling back to valid JWT signature",
      );
    }

    request.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      sessionId: decoded.sessionId ?? "",
    };
  } catch (err: any) {
    if (request.cookies && request.cookies[AUTH_COOKIE_NAME]) {
      reply.clearCookie(AUTH_COOKIE_NAME, {
        path: "/",
        httpOnly: true,
        secure:
          env.COOKIE_SAME_SITE === "none"
            ? true
            : env.NODE_ENV === "production",
        sameSite: env.COOKIE_SAME_SITE,
      });
    }
    if (err instanceof AppError) {
      throw err;
    }
    throw AppError.unauthorized("Invalid or expired token");
  }
}

// requireAuth is an alias for authenticate per spec
export const requireAuth = authenticate;

// Helper to retrieve current user without throwing
export function getCurrentUser(
  request: FastifyRequest,
): AuthenticatedRequestUser | null {
  return request.user ?? null;
}
