import { z } from "zod";
import {
  ResumeQualityCategory,
  FindingSeverity,
  ResumeQualityReportStatus,
  RESUME_QUALITY_WEIGHTS,
  type ResumeQualityCategoryType,
  type FindingSeverityType,
  type ResumeQualityReportStatusType,
} from "../constants/index.js";
import { ChangeSectionSchema, type ChangeSection } from "./content-writer.schema.js";

// ─── Enums & Literals ─────────────────────────────────────────────────────────

export const ResumeQualityCategorySchema = z.nativeEnum(ResumeQualityCategory);
export const FindingSeveritySchema = z.nativeEnum(FindingSeverity);
export const ResumeQualityReportStatusSchema = z.nativeEnum(
  ResumeQualityReportStatus,
);


export const QualityStatusLabelSchema = z.enum([
  "Excellent",
  "Good",
  "Needs Improvement",
  "Needs Attention",
]);
export type QualityStatusLabel = z.infer<typeof QualityStatusLabelSchema>;

export const FindingClassificationSchema = z.enum([
  "PASSIVE_VOICE",
  "WEAK_ACTION_VERB",
  "VAGUE_WORDING",
  "LOW_SPECIFICITY",
]);
export type FindingClassification = z.infer<typeof FindingClassificationSchema>;

export const TechnologySourceSchema = z.enum([
  "EXPERIENCE",
  "PROJECT",
  "SKILLS",
  "CERTIFICATION",
  "OTHER",
]);
export type TechnologySource = z.infer<typeof TechnologySourceSchema>;

// Human-friendly category display names
export const CATEGORY_DISPLAY_NAMES: Record<ResumeQualityCategoryType, string> = {
  ATS_STRUCTURE: "ATS Structure",
  CONTENT_QUALITY: "Content Quality",
  EXPERIENCE_QUALITY: "Experience Quality",
  SKILLS_KEYWORDS: "Skills & Keywords",
  EDUCATION_CERTIFICATIONS: "Education & Certifications",
  CONTACT_LINKS: "Contact & Links",
  FORMATTING_PARSEABILITY: "Formatting / Parseability",
  CONSISTENCY: "Consistency",
};

// ─── Findings Schema ──────────────────────────────────────────────────────────

export const ResumeQualityFindingSchema = z.object({
  id: z.string(),
  category: ResumeQualityCategorySchema,
  severity: FindingSeveritySchema,
  title: z.string(),
  description: z.string(),
  whyItMatters: z.string().optional(),
  recommendation: z.string(),
  section: ChangeSectionSchema.optional(),
  itemId: z.string().optional(),
  field: z.string().optional(),
  evidence: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  classification: FindingClassificationSchema.optional(),
  source: TechnologySourceSchema.optional(),
});
export type ResumeQualityFinding = z.infer<typeof ResumeQualityFindingSchema>;

// ─── Category Score Schema ───────────────────────────────────────────────────

export const CategoryScoreSchema = z.object({
  category: ResumeQualityCategorySchema,
  name: z.string(),
  score: z.number().min(0).max(100),
  maxScore: z.number().default(100),
  weight: z.number().min(0).max(1),
  status: QualityStatusLabelSchema,
  findings: z.array(ResumeQualityFindingSchema),
  recommendations: z.array(z.string()),
});
export type CategoryScore = z.infer<typeof CategoryScoreSchema>;

// ─── Optional Job Match Summary (Phase 7 Integration) ────────────────────────

export const JobMatchSummarySchema = z.object({
  matchScore: z.number(),
  matchId: z.string().optional(),
  jobId: z.string().optional(),
  jobTitle: z.string().optional(),
  company: z.string().nullable().optional(),
  missingKeywords: z.array(z.string()).default([]),
  missingRequirements: z.array(z.string()).default([]),
});
export type JobMatchSummary = z.infer<typeof JobMatchSummarySchema>;

// ─── Complete Resume Quality Report ──────────────────────────────────────────

export const ResumeQualityReportSchema = z.object({
  id: z.string(),
  resumeId: z.string(),
  resumeVersionId: z.string().nullable().optional(),
  jobId: z.string().nullable().optional(),
  overallScore: z.number().min(0).max(100),
  status: ResumeQualityReportStatusSchema,
  statusLabel: QualityStatusLabelSchema,
  summary: z.string(),
  categories: z.record(ResumeQualityCategorySchema, CategoryScoreSchema),
  strengths: z.array(z.string()).default([]),
  criticalIssuesCount: z.number().default(0),
  findings: z.array(ResumeQualityFindingSchema).default([]),
  contentHash: z.string(),
  jobHash: z.string().nullable().optional(),
  analyzedAt: z.string(),
  resumeUpdatedAt: z.string(),
  analyzerVersion: z.string().default("1.0"),
  scoringVersion: z.string().default("1.0"),
  jobMatch: JobMatchSummarySchema.nullable().optional(),
});
export type ResumeQualityReport = z.infer<typeof ResumeQualityReportSchema>;

// ─── API Request Schemas ─────────────────────────────────────────────────────

export const AnalyzeResumeQualityInputSchema = z.object({
  jobId: z.string().uuid().optional(),
  forceRefresh: z.boolean().optional().default(false),
});
export type AnalyzeResumeQualityInput = z.infer<
  typeof AnalyzeResumeQualityInputSchema
>;

// ─── LLM Agent Structured Output Schema ──────────────────────────────────────

export const AIQualityFindingSchema = z.object({
  category: ResumeQualityCategorySchema,
  severity: FindingSeveritySchema,
  title: z.string(),
  description: z.string(),
  whyItMatters: z.string(),
  recommendation: z.string(),
  section: ChangeSectionSchema.optional(),
  itemId: z.string().optional(),
  field: z.string().optional(),
  evidence: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});
export type AIQualityFinding = z.infer<typeof AIQualityFindingSchema>;

export const AIQualityAnalysisOutputSchema = z.object({
  clarityAssessment: z.string(),
  contentStrengths: z.array(z.string()),
  contentFindings: z.array(AIQualityFindingSchema),
  actionableRecommendations: z.array(z.string()),
});
export type AIQualityAnalysisOutput = z.infer<
  typeof AIQualityAnalysisOutputSchema
>;
