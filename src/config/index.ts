import { z } from "zod";
import dotenv from "dotenv";
import path from "path";

// Load .env from current directory first, with monorepo fallback in dev
dotenv.config();
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
}

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_PORT: z.coerce.number().default(4000),
  API_HOST: z.string().default("127.0.0.1"),
  API_CORS_ORIGIN: z.string().default("http://localhost:3000"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

  DATABASE_URL: z
    .string()
    .default(
      "postgresql://postgres:postgres@localhost:5432/resumeai?schema=public",
    ),
  DIRECT_URL: z.string().optional(),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  OPENAI_API_KEY: z.string().default("sk-placeholder"),
  AI_DEFAULT_MODEL: z.string().default("gpt-4o"),
  AI_FAST_MODEL: z.string().default("gpt-4o-mini"),
  AI_PROVIDER: z.enum(["groq", "openai", "mock"]).default("groq"),
  GROQ_API_KEY: z.string().default("gsk-placeholder"),
  GROQ_MODEL: z.string().default("openai/gpt-oss-120b"),
  AI_USE_MOCK: z
    .string()
    .transform((v) => v === "true")
    .default("false"),

  JWT_SECRET: z
    .string()
    .min(16)
    .default("development-jwt-secret-key-min-16-chars"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  COOKIE_SECRET: z
    .string()
    .min(16)
    .default("development-cookie-secret-key-min-16-chars"),
  COOKIE_SAME_SITE: z.enum(["lax", "none", "strict"]).default("lax"),
  PDF_RENDERER: z.enum(["playwright", "puppeteer"]).default("playwright"),


  STORAGE_PROVIDER: z.enum(["local", "s3", "b2"]).default("local"),
  LOCAL_STORAGE_DIR: z.string().default("./uploads"),
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().default("resumeai-uploads"),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  // Backblaze B2 Storage Configuration
  B2_KEY_ID: z.string().optional(),
  B2_APPLICATION_KEY: z.string().optional(),
  B2_BUCKET_NAME: z.string().default("resumeai-storage-2026"),
  B2_ENDPOINT: z.string().default("https://s3.us-east-005.backblazeb2.com"),
  B2_REGION: z.string().default("us-east-005"),
  B2_INTEGRATION_TEST: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.STORAGE_PROVIDER === "b2") {
    const keyId = data.B2_KEY_ID || data.S3_ACCESS_KEY_ID;
    const appKey = data.B2_APPLICATION_KEY || data.S3_SECRET_ACCESS_KEY;
    const bucket = data.B2_BUCKET_NAME || data.S3_BUCKET;
    const endpoint = data.B2_ENDPOINT || data.S3_ENDPOINT;

    if (!keyId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["B2_KEY_ID"],
        message:
          "B2_KEY_ID (or S3_ACCESS_KEY_ID) is required when STORAGE_PROVIDER is 'b2'",
      });
    }
    if (!appKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["B2_APPLICATION_KEY"],
        message:
          "B2_APPLICATION_KEY (or S3_SECRET_ACCESS_KEY) is required when STORAGE_PROVIDER is 'b2'",
      });
    }
    if (!bucket) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["B2_BUCKET_NAME"],
        message:
          "B2_BUCKET_NAME (or S3_BUCKET) is required when STORAGE_PROVIDER is 'b2'",
      });
    }
    if (!endpoint) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["B2_ENDPOINT"],
        message:
          "B2_ENDPOINT (or S3_ENDPOINT) is required when STORAGE_PROVIDER is 'b2'",
      });
    }
  } else if (data.STORAGE_PROVIDER === "s3") {
    if (!data.S3_ACCESS_KEY_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["S3_ACCESS_KEY_ID"],
        message: "S3_ACCESS_KEY_ID is required when STORAGE_PROVIDER is 's3'",
      });
    }
    if (!data.S3_SECRET_ACCESS_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["S3_SECRET_ACCESS_KEY"],
        message:
          "S3_SECRET_ACCESS_KEY is required when STORAGE_PROVIDER is 's3'",
      });
    }
    if (!data.S3_BUCKET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["S3_BUCKET"],
        message: "S3_BUCKET is required when STORAGE_PROVIDER is 's3'",
      });
    }
  }
});

export { EnvSchema };
export type EnvConfig = z.infer<typeof EnvSchema>;

function loadConfig(): EnvConfig {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.format());
    throw new Error("Invalid environment configuration");
  }
  return parsed.data;
}

export const env = loadConfig();
