import { env } from "../config/index.js";

export const loggerConfig = {
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === "development"
      ? {
          target: "pino/file",
        }
      : undefined,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "body.password",
      "body.apiKey",
      "*.token",
      "*.secret",
    ],
    remove: true,
  },
};

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== "test") {
      console.log(`[INFO] ${msg}`, meta ? JSON.stringify(meta) : "");
    }
  },
  error: (msg: string, meta?: Record<string, unknown>) => {
    console.error(`[ERROR] ${msg}`, meta ? JSON.stringify(meta) : "");
  },
  warn: (msg: string, meta?: Record<string, unknown>) => {
    console.warn(`[WARN] ${msg}`, meta ? JSON.stringify(meta) : "");
  },
};
