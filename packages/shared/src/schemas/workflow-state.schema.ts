import { z } from "zod";
import { WorkflowStatus, WorkflowType } from "../constants/index.js";
import { ResumeSchema } from "./resume.schema.js";
import { JobAnalysisSchema, MatchAnalysisSchema } from "./job.schema.js";
import {
  StrategySchema,
  GeneratedContentSchema,
  ATSAnalysisSchema,
  QualityReviewSchema,
} from "./ai.schema.js";
import { FactCheckResultSchema } from "./evidence.schema.js";

export const RevisionHistoryItemSchema = z.object({
  revisionNumber: z.number(),
  agentName: z.string(),
  timestamp: z.string().datetime(),
  summaryOfChanges: z.string(),
});

export type RevisionHistoryItem = z.infer<typeof RevisionHistoryItemSchema>;

export const WorkflowErrorSchema = z.object({
  agentName: z.string(),
  code: z.string(),
  message: z.string(),
  timestamp: z.string().datetime(),
  retryable: z.boolean().default(false),
});

export type WorkflowError = z.infer<typeof WorkflowErrorSchema>;

export const ResumeWorkflowStateSchema = z.object({
  workflowId: z.string().uuid(),
  userId: z.string().min(1),
  workflowType: z.enum([
    WorkflowType.CREATE_RESUME,
    WorkflowType.JOB_TAILORING,
    WorkflowType.RESUME_REVIEW,
  ]),
  status: z.enum([
    WorkflowStatus.PENDING,
    WorkflowStatus.RUNNING,
    WorkflowStatus.COMPLETED,
    WorkflowStatus.FAILED,
    WorkflowStatus.CANCELLED,
  ]),
  currentStep: z.string().optional(),
  retryCount: z.number().int().min(0).default(0),
  maxRetries: z.number().int().min(0).default(3),

  // Identifiers
  resumeId: z.string().optional(),
  resumeVersionId: z.string().optional(),
  jobDescriptionId: z.string().optional(),

  // Workflow Data Payloads
  rawResumeText: z.string().optional(),
  originalResume: ResumeSchema.optional(),
  parsedResume: ResumeSchema.optional(),
  rawJobText: z.string().optional(),
  jobAnalysis: JobAnalysisSchema.optional(),
  keywordAnalysis: z.record(z.string(), z.any()).optional(),
  matchingAnalysis: MatchAnalysisSchema.optional(),
  strategy: StrategySchema.optional(),
  generatedContent: GeneratedContentSchema.optional(),
  factVerification: FactCheckResultSchema.optional(),
  atsAnalysis: ATSAnalysisSchema.optional(),
  qualityReview: QualityReviewSchema.optional(),

  // Result & Audit Trails
  finalResume: ResumeSchema.optional(),
  revisionHistory: z.array(RevisionHistoryItemSchema).default([]),
  errors: z.array(WorkflowErrorSchema).default([]),
  metadata: z.record(z.string(), z.any()).default({}),

  // Timestamps & Metrics
  totalTokensUsed: z.number().int().default(0),
  estimatedCostUsd: z.number().default(0),
  startedAt: z
    .string()
    .datetime()
    .default(() => new Date().toISOString()),
  completedAt: z.string().datetime().optional(),
});

export type ResumeWorkflowState = z.infer<typeof ResumeWorkflowStateSchema>;
