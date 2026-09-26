import { FastifyRequest, FastifyReply } from "fastify";
import { whopOAuthService, PkceState } from "../services/whop-oauth.service.js";
import {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
  WHOP_PKCE_COOKIE_NAME,
  getWhopPkceCookieOptions,
  getClearWhopPkceCookieOptions,
  getClearAuthCookieOptions,
} from "../utils/cookies.js";
import { authService } from "../services/auth.service.js";
import { env } from "../config/index.js";

function setNoStoreHeaders(reply: FastifyReply) {
  reply.header(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate, private",
  );
  reply.header("Pragma", "no-cache");
  reply.header("Expires", "0");
}

function getAppBaseUrl(request: FastifyRequest): string {
  const host = request.headers.host;
  if (
    host &&
    (host.includes("localhost") || host.includes("127.0.0.1")) &&
    env.NODE_ENV !== "production"
  ) {
    return "http://localhost:3000";
  }
  return env.APP_URL.replace(/\/+$/, "");
}

export class WhopOAuthController {
  async login(request: FastifyRequest, reply: FastifyReply) {
    setNoStoreHeaders(reply);

    const pkce = whopOAuthService.generatePkce();
    const redirectUri = whopOAuthService.getRedirectUri(request.headers.host);

    reply.setCookie(
      WHOP_PKCE_COOKIE_NAME,
      JSON.stringify(pkce),
      getWhopPkceCookieOptions(),
    );

    const authorizeUrl = whopOAuthService.buildAuthorizeUrl(pkce, redirectUri);
    return reply.redirect(authorizeUrl);
  }

  async callback(
    request: FastifyRequest<{
      Querystring: {
        code?: string;
        state?: string;
        error?: string;
        error_description?: string;
      };
    }>,
    reply: FastifyReply,
  ) {
    setNoStoreHeaders(reply);

    const appBase = getAppBaseUrl(request);
    const { code, state, error, error_description } = request.query;

    if (error) {
      reply.clearCookie(
        WHOP_PKCE_COOKIE_NAME,
        getClearWhopPkceCookieOptions(),
      );
      const safeError = encodeURIComponent(error_description || error);
      return reply.redirect(`${appBase}/login?error=${safeError}`);
    }

    if (!code || !state) {
      reply.clearCookie(
        WHOP_PKCE_COOKIE_NAME,
        getClearWhopPkceCookieOptions(),
      );
      return reply.redirect(`${appBase}/login?error=missing_oauth_params`);
    }

    const rawPkce = request.cookies?.[WHOP_PKCE_COOKIE_NAME];
    if (!rawPkce) {
      return reply.redirect(`${appBase}/login?error=missing_pkce_state`);
    }

    let pkce: PkceState;
    try {
      pkce = JSON.parse(rawPkce);
    } catch {
      reply.clearCookie(
        WHOP_PKCE_COOKIE_NAME,
        getClearWhopPkceCookieOptions(),
      );
      return reply.redirect(`${appBase}/login?error=invalid_pkce_state`);
    }

    const redirectUri = whopOAuthService.getRedirectUri(request.headers.host);

    try {
      const result = await whopOAuthService.authenticateFromCallback({
        code,
        state,
        expectedState: pkce.state,
        codeVerifier: pkce.codeVerifier,
        expectedNonce: pkce.nonce,
        redirectUri,
      });

      // Set standard ResumeAI authentication session cookie
      reply.setCookie(
        AUTH_COOKIE_NAME,
        result.token,
        getAuthCookieOptions(),
      );

      // Clear temporary PKCE state cookie
      reply.clearCookie(
        WHOP_PKCE_COOKIE_NAME,
        getClearWhopPkceCookieOptions(),
      );

      // Redirect user to authenticated dashboard
      return reply.redirect(`${appBase}/dashboard`);
    } catch (err: any) {
      reply.clearCookie(
        WHOP_PKCE_COOKIE_NAME,
        getClearWhopPkceCookieOptions(),
      );
      const safeMsg = encodeURIComponent(
        err?.message || "Whop authentication failed",
      );
      return reply.redirect(`${appBase}/login?error=${safeMsg}`);
    }
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    setNoStoreHeaders(reply);

    const appBase = getAppBaseUrl(request);

    if (request.user?.sessionId) {
      await authService.logout(request.user.sessionId).catch(() => {});
    }

    reply.clearCookie(AUTH_COOKIE_NAME, getClearAuthCookieOptions());
    reply.clearCookie(WHOP_PKCE_COOKIE_NAME, getClearWhopPkceCookieOptions());

    return reply.redirect(`${appBase}/login`);
  }
}

export const whopOAuthController = new WhopOAuthController();
