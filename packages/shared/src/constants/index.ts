export const VerificationStatus = {
  SUPPORTED: "SUPPORTED",
  UNSUPPORTED: "UNSUPPORTED",
  CONTRADICTED: "CONTRADICTED",
  UNCERTAIN: "UNCERTAIN",
} as const;

export type VerificationStatusType =
  (typeof VerificationStatus)[keyof typeof VerificationStatus];

export const WorkflowStatus = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;

export type WorkflowStatusType =
  (typeof WorkflowStatus)[keyof typeof WorkflowStatus];

export const WorkflowType = {
  CREATE_RESUME: "CREATE_RESUME",
  JOB_TAILORING: "JOB_TAILORING",
  RESUME_REVIEW: "RESUME_REVIEW",
} as const;

export type WorkflowTypeType = (typeof WorkflowType)[keyof typeof WorkflowType];

export const AgentName = {
  INTAKE: "IntakeAgent",
  RESUME_PARSER: "ResumeParserAgent",
  JOB_ANALYZER: "JobAnalyzerAgent",
  MATCHER: "MatcherAgent",
  STRATEGY: "StrategyAgent",
  CONTENT_WRITER: "ContentWriterAgent",
  FACT_GUARD: "FactGuardAgent",
  ATS_ANALYZER: "ATSAnalyzerAgent",
  QUALITY_REVIEWER: "QualityReviewerAgent",
} as const;

export type AgentNameType = (typeof AgentName)[keyof typeof AgentName];

export const ErrorCode = {
  BAD_REQUEST: "BAD_REQUEST",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  AI_PROVIDER_ERROR: "AI_PROVIDER_ERROR",
  DOCUMENT_EXTRACTION_ERROR: "DOCUMENT_EXTRACTION_ERROR",
  FACT_CHECK_FAILED: "FACT_CHECK_FAILED",
  IMAGE_ONLY_DOCUMENT: "IMAGE_ONLY_DOCUMENT",
  EXTRACTION_SUSPECTED_INCOMPLETE: "EXTRACTION_SUSPECTED_INCOMPLETE",
  PARSER_POSSIBLE_DATA_LOSS: "PARSER_POSSIBLE_DATA_LOSS",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

export const SubscriptionTier = {
  FREE: "FREE",
  PRO: "PRO",
  ENTERPRISE: "ENTERPRISE",
} as const;

export type SubscriptionTierType =
  (typeof SubscriptionTier)[keyof typeof SubscriptionTier];

// Phase 10: Resume Quality & ATS Readiness Constants
export const ResumeQualityCategory = {
  ATS_STRUCTURE: "ATS_STRUCTURE",
  CONTENT_QUALITY: "CONTENT_QUALITY",
  EXPERIENCE_QUALITY: "EXPERIENCE_QUALITY",
  SKILLS_KEYWORDS: "SKILLS_KEYWORDS",
  EDUCATION_CERTIFICATIONS: "EDUCATION_CERTIFICATIONS",
  CONTACT_LINKS: "CONTACT_LINKS",
  FORMATTING_PARSEABILITY: "FORMATTING_PARSEABILITY",
  CONSISTENCY: "CONSISTENCY",
} as const;

export type ResumeQualityCategoryType =
  (typeof ResumeQualityCategory)[keyof typeof ResumeQualityCategory];

export const FindingSeverity = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
  INFO: "INFO",
} as const;

export type FindingSeverityType =
  (typeof FindingSeverity)[keyof typeof FindingSeverity];

/**
 * Centralized weights model for Resume Quality Scoring.
 * Total strictly equals 1.00 (100%).
 */
export const RESUME_QUALITY_WEIGHTS: Record<ResumeQualityCategoryType, number> = {
  ATS_STRUCTURE: 0.20,
  CONTENT_QUALITY: 0.20,
  EXPERIENCE_QUALITY: 0.20,
  SKILLS_KEYWORDS: 0.15,
  EDUCATION_CERTIFICATIONS: 0.10,
  CONTACT_LINKS: 0.05,
  FORMATTING_PARSEABILITY: 0.05,
  CONSISTENCY: 0.05,
} as const;

export const ResumeQualityReportStatus = {
  CURRENT: "CURRENT",
  STALE: "STALE",
} as const;

export type ResumeQualityReportStatusType =
  (typeof ResumeQualityReportStatus)[keyof typeof ResumeQualityReportStatus];
