import { z } from "zod";
import { ErrorCode } from "../constants/index.js";
import { ResumeDataSchema } from "./resume.schema.js";
import { TemplateConfigSchema, TemplateIdSchema } from "./template.schema.js";

export const ApiHealthResponseSchema = z.object({
  success: z.literal(true),
  service: z.literal("resumeai-api"),
  status: z.literal("healthy"),
  timestamp: z.string().datetime().optional(),
  uptimeSeconds: z.number().optional(),
});

export type ApiHealthResponse = z.infer<typeof ApiHealthResponseSchema>;

export const ApiErrorPayloadSchema = z.object({
  code: z.string().default(ErrorCode.INTERNAL_SERVER_ERROR),
  message: z.string(),
  details: z.any().optional(),
});

export type ApiErrorPayload = z.infer<typeof ApiErrorPayloadSchema>;

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.union([
    z.object({
      success: z.literal(true),
      data: dataSchema,
      message: z.string().optional(),
    }),
    z.object({
      success: z.literal(false),
      error: ApiErrorPayloadSchema,
    }),
  ]);

// Auth request schemas
export const RegisterRequestSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

// Resume request schemas
export const CreateResumeRequestSchema = z.object({
  title: z.string().min(1, "Title is required").default("My Resume"),
  templateId: z.string().default("modern-standard"),
  targetRole: z.string().optional(),
  initialData: ResumeDataSchema.optional(),
  templateConfig: TemplateConfigSchema.optional(),
});

export type CreateResumeRequest = z.infer<typeof CreateResumeRequestSchema>;

export const UpdateResumeRequestSchema = z.object({
  title: z.string().min(1).optional(),
  targetRole: z.string().optional(),
  templateId: z.string().optional(),
  templateConfig: TemplateConfigSchema.optional(),
  resumeData: ResumeDataSchema.optional(),
  changeSummary: z.string().optional(),
  createVersion: z.boolean().optional(),
});

export type UpdateResumeRequest = z.infer<typeof UpdateResumeRequestSchema>;

export const UpdateResumeDesignRequestSchema = z.object({
  templateId: TemplateIdSchema.optional(),
  templateConfig: TemplateConfigSchema.optional(),
});

export type UpdateResumeDesignRequest = z.infer<
  typeof UpdateResumeDesignRequestSchema
>;

export const DuplicateResumeRequestSchema = z.object({
  title: z.string().min(1).optional(),
});

export type DuplicateResumeRequest = z.infer<
  typeof DuplicateResumeRequestSchema
>;

export const CreateVersionRequestSchema = z.object({
  changeSummary: z.string().min(1, "Change summary is required").optional(),
});

export type CreateVersionRequest = z.infer<typeof CreateVersionRequestSchema>;

// Job description request schemas
export const CreateJobRequestSchema = z.object({
  title: z.string().optional(),
  company: z.string().optional(),
  rawText: z
    .string()
    .min(50, "Job description text must be at least 50 characters")
    .max(
      30000,
      "Job description text exceeds maximum limit of 30,000 characters",
    ),
  url: z.string().url().optional().or(z.literal("")),
  resumeId: z.string().uuid().optional(),
  autoAnalyze: z.boolean().default(true),
});

export type CreateJobRequest = z.infer<typeof CreateJobRequestSchema>;

// Phase 7 Match Request Schema
export const CreateMatchRequestSchema = z.object({
  resumeId: z.string().uuid("Invalid resume ID"),
  jobId: z.string().uuid("Invalid job ID"),
});

export type CreateMatchRequest = z.infer<typeof CreateMatchRequestSchema>;

// Workflow trigger schema
export const TriggerWorkflowRequestSchema = z.object({
  workflowType: z.enum(["CREATE_RESUME", "JOB_TAILORING", "RESUME_REVIEW"]),
  resumeId: z.string().optional(),
  jobId: z.string().optional(),
  rawInput: z.string().optional(),
  targetRole: z.string().optional(),
});

export type TriggerWorkflowRequest = z.infer<
  typeof TriggerWorkflowRequestSchema
>;

// User profile schemas
export const UpdateProfileRequestSchema = z
  .object({
    name: z.string().min(1, "Name is required").optional(),
  })
  .strict();

export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

export const UserProfileResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(["USER", "ADMIN"]),
  subscriptionTier: z.enum(["FREE", "PRO", "ENTERPRISE"]),
  creditsBalance: z.number(),
  image: z.string().nullable(),
  emailVerified: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type UserProfileResponse = z.infer<typeof UserProfileResponseSchema>;
