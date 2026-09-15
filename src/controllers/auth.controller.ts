import { FastifyRequest, FastifyReply } from "fastify";
import { authService } from "../services/auth.service.js";
import { RegisterRequestSchema, LoginRequestSchema } from "@resumeai/shared";
import { sendCreated, sendSuccess } from "../utils/response.js";
import { AUTH_COOKIE_NAME, getAuthCookieOptions } from "../utils/cookies.js";

export class AuthController {
  async register(request: FastifyRequest, reply: FastifyReply) {
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
    const sessionId = request.user?.sessionId;
    const cookieToken = request.cookies?.[AUTH_COOKIE_NAME];

    await authService.logout(sessionId, cookieToken);

    reply.clearCookie(AUTH_COOKIE_NAME, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    return sendSuccess(
      reply,
      { success: true },
      200,
      "Logged out successfully",
    );
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    const profile = await authService.getProfile(request.user!.id);
    return sendSuccess(reply, profile);
  }
}

export const authController = new AuthController();
