import { FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import { authService } from "../services/auth.service.js";
import { RegisterRequestSchema, LoginRequestSchema } from "@resumeai/shared";
import { sendCreated, sendSuccess } from "../utils/response.js";
import {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
  getClearAuthCookieOptions,
} from "../utils/cookies.js";

function setNoStoreHeaders(reply: FastifyReply) {
  reply.header(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate, private",
  );
  reply.header("Pragma", "no-cache");
  reply.header("Expires", "0");
}

function sanitizeToken(raw: string): string {
  let clean = raw.trim();
  if (clean.startsWith('"') && clean.endsWith('"')) {
    clean = clean.slice(1, -1).trim();
  }
  if (clean.startsWith("Bearer ")) {
    clean = clean.substring(7).trim();
  }
  return clean;
}

export class AuthController {
  async register(request: FastifyRequest, reply: FastifyReply) {
    setNoStoreHeaders(reply);
    const body = RegisterRequestSchema.parse(request.body);
    const result = await authService.register(body);

    reply.setCookie(AUTH_COOKIE_NAME, result.token, getAuthCookieOptions());

    return sendCreated(
      reply,
      { user: result.user, token: result.token },
      "User registered successfully",
    );
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    setNoStoreHeaders(reply);
    const body = LoginRequestSchema.parse(request.body);
    const result = await authService.login(body);

    reply.setCookie(AUTH_COOKIE_NAME, result.token, getAuthCookieOptions());

    return sendSuccess(
      reply,
      { user: result.user, token: result.token },
      200,
      "Login successful",
    );
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    setNoStoreHeaders(reply);

    const candidateTokens = new Set<string>();
    const sessionIds = new Set<string>();
    const userIds = new Set<string>();

    if (request.user?.sessionId) {
      sessionIds.add(request.user.sessionId);
    }
    if (request.user?.id) {
      userIds.add(request.user.id);
    }

    const cookieToken = request.cookies?.[AUTH_COOKIE_NAME];
    if (cookieToken) {
      candidateTokens.add(sanitizeToken(cookieToken));
    }

    // Also inspect raw Cookie header in case multiple cookies with the same name exist
    const rawCookieHeader = request.headers.cookie;
    if (rawCookieHeader) {
      for (const pair of rawCookieHeader.split(";")) {
        const [name, ...rest] = pair.trim().split("=");
        if (name === AUTH_COOKIE_NAME && rest.length > 0) {
          const val = sanitizeToken(decodeURIComponent(rest.join("=")));
          if (val) candidateTokens.add(val);
        }
      }
    }

    // Also inspect Authorization Bearer header
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const val = sanitizeToken(authHeader.substring(7));
      if (val) candidateTokens.add(val);
    }

    for (const token of candidateTokens) {
      try {
        const decoded = jwt.decode(token) as any;
        if (decoded?.sessionId) sessionIds.add(String(decoded.sessionId));
        if (decoded?.id) userIds.add(String(decoded.id));
      } catch {
        // ignore malformed tokens
      }
    }

    for (const sid of sessionIds) {
      try {
        await authService.logout(sid, undefined, undefined);
      } catch {
        // ignore DB cleanup error
      }
    }

    for (const token of candidateTokens) {
      try {
        await authService.logout(undefined, token, undefined);
      } catch {
        // ignore DB cleanup error
      }
    }

    for (const uid of userIds) {
      try {
        await authService.logout(undefined, undefined, uid);
      } catch {
        // ignore DB cleanup error
      }
    }

    reply.clearCookie(AUTH_COOKIE_NAME, getClearAuthCookieOptions());

    return sendSuccess(
      reply,
      { success: true },
      200,
      "Logged out successfully",
    );
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    setNoStoreHeaders(reply);
    const profile = await authService.getProfile(request.user!.id);
    return sendSuccess(reply, profile);
  }
}

export const authController = new AuthController();
