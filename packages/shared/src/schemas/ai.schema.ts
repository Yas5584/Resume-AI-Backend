import { z } from "zod";

export const StrategySchema = z.object({
  targetAngle: z
    .string()
    .describe("Primary positioning narrative for candidate"),
  keywordsToEmphasize: z.array(z.string()).default([]),
  sectionsToPrioritize: z.array(z.string()).default([]),
  suggestedFraming: z
    .record(z.string(), z.string())
    .default({})
    .describe("Key-value map of section to framing strategy"),
  strategicRecommendations: z.array(z.string()).default([]),
});

export type Strategy = z.infer<typeof StrategySchema>;

export const BulletRewriteSchema = z.object({
  originalBullet: z.string(),
  rewrittenBullet: z.string(),
  keywordsAdded: z.array(z.string()).default([]),
  metricOrImpactAdded: z.string().optional(),
  evidenceIdRef: z
    .string()
    .describe("Reference to supporting evidence claim ID"),
});

export type BulletRewrite = z.infer<typeof BulletRewriteSchema>;

export const GeneratedContentSchema = z.object({
  tailoredSummary: z.string(),
  bulletRewrites: z.array(BulletRewriteSchema).default([]),
  suggestedSkillAdditions: z.array(z.string()).default([]),
  rationale: z
    .string()
    .describe("Explanation of modifications made based on strategy"),
});

export type GeneratedContent = z.infer<typeof GeneratedContentSchema>;

export const ATSAnalysisSchema = z.object({
  atsScore: z.number().min(0).max(100),
  parseabilityScore: z.number().min(0).max(100),
  keywordMatchPercentage: z.number().min(0).max(100),
  matchedKeywords: z.array(z.string()).default([]),
  missingHighValueKeywords: z.array(z.string()).default([]),
  formattingFlags: z
    .array(z.string())
    .default([])
    .describe("Issues like tables, columns, unusual headers"),
  recommendations: z.array(z.string()).default([]),
});

export type ATSAnalysis = z.infer<typeof ATSAnalysisSchema>;

export const QualityReviewSchema = z.object({
  overallScore: z.number().min(0).max(100),
  approved: z
    .boolean()
    .describe(
      "True if resume passes quality thresholds for tone, grammar, and ATS standards",
    ),
  clarityScore: z.number().min(0).max(100),
  impactScore: z.number().min(0).max(100),
  grammaticalFlags: z.array(z.string()).default([]),
  actionVerbStrength: z.enum(["WEAK", "MODERATE", "STRONG"]).default("STRONG"),
  critiqueNotes: z.string().describe("Holistic feedback for final polish"),
});

export type QualityReview = z.infer<typeof QualityReviewSchema>;

export const AIUsageRecordSchema = z.object({
  agentName: z.string(),
  model: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
  timestamp: z
    .string()
    .datetime()
    .default(() => new Date().toISOString()),
});

export type AIUsageRecord = z.infer<typeof AIUsageRecordSchema>;
