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
  const sameSite = env.COOKIE_SAME_SITE;
  // Browsers reject SameSite=None cookies unless secure=true
  const secure = sameSite === "none" ? true : env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    maxAge: parseDurationToSeconds(env.JWT_EXPIRES_IN),
    signed: false, // We use standard HttpOnly JWT so it can also be inspected if needed or kept simple
  };
}
