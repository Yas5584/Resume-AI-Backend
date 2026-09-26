import { CookieSerializeOptions } from "@fastify/cookie";
import { env } from "../config/index.js";

export const AUTH_COOKIE_NAME = "resumeai_session";

function parseDurationToSeconds(durationStr: string): number {
  const match = durationStr.match(/^(\d+)([smhdwy])?$/);
  if (!match) return 7 * 24 * 60 * 60; // default to 7 days
  const val = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case "s":
      return val;
    case "m":
      return val * 60;
    case "h":
      return val * 60 * 60;
    case "d":
      return val * 24 * 60 * 60;
    case "w":
      return val * 7 * 24 * 60 * 60;
    case "y":
      return val * 365 * 24 * 60 * 60;
    default:
      return val;
  }
}

export function getAuthCookieOptions(): CookieSerializeOptions {
  const isProd = env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  // If explicitly set in environment, use that; otherwise default to "none" in production
  // (required for Whop embedded iframe) and "lax" in local development.
  const sameSite =
    env.COOKIE_SAME_SITE !== "lax"
      ? env.COOKIE_SAME_SITE
      : isProd
        ? "none"
        : "lax";

  const secure = sameSite === "none" ? true : isProd;

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    maxAge: parseDurationToSeconds(env.JWT_EXPIRES_IN),
    signed: false,
  };
}

/**
 * Returns canonical cookie deletion options matching getAuthCookieOptions()
 * (same name, path, httpOnly, secure, sameSite) so the browser removes the cookie reliably.
 */
export function getClearAuthCookieOptions(): CookieSerializeOptions {
  const { httpOnly, secure, sameSite, path } = getAuthCookieOptions();
  return {
    httpOnly,
    secure,
    sameSite,
    path,
    maxAge: 0,
    expires: new Date(0),
    signed: false,
  };
}

export const WHOP_PKCE_COOKIE_NAME = "whop_pkce";

export function getWhopPkceCookieOptions(): CookieSerializeOptions {
  const isProd = env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  const sameSite =
    env.COOKIE_SAME_SITE !== "lax"
      ? env.COOKIE_SAME_SITE
      : isProd
        ? "none"
        : "lax";
  const secure = sameSite === "none" ? true : isProd;

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    maxAge: 600, // 10 minutes
    signed: false,
  };
}

export function getClearWhopPkceCookieOptions(): CookieSerializeOptions {
  const { httpOnly, secure, sameSite, path } = getWhopPkceCookieOptions();
  return {
    httpOnly,
    secure,
    sameSite,
    path,
    maxAge: 0,
    expires: new Date(0),
    signed: false,
  };
}
