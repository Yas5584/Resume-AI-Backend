import { z } from "zod";
import { VerificationStatusSchema } from "./evidence.schema.js";

export const ContentProposalStatusEnum = {
  DRAFT: "DRAFT",
  PARTIALLY_ACCEPTED: "PARTIALLY_ACCEPTED",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  STALE: "STALE",
  APPLIED: "APPLIED",
} as const;

export const ContentProposalStatusSchema = z.enum([
  "DRAFT",
  "PARTIALLY_ACCEPTED",
  "ACCEPTED",
  "REJECTED",
  "STALE",
  "APPLIED",
]);
export type ContentProposalStatus = z.infer<typeof ContentProposalStatusSchema>;

export const ChangeTypeSchema = z.enum([
  "REWRITE",
  "CLARIFY",
  "KEYWORD_ALIGNMENT",
  "CONDENSE",
  "EXPAND",
  "REORDER",
]);
export type ChangeType = z.infer<typeof ChangeTypeSchema>;

export const ChangeSectionSchema = z.enum([
  "summary",
  "experience",
  "projects",
  "skills",
  "education",
  "certifications",
  "achievements",
  "languages",
  "links",
]);
export type ChangeSection = z.infer<typeof ChangeSectionSchema>;

export const ChangeRiskSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type ChangeRisk = z.infer<typeof ChangeRiskSchema>;

export const ChangeStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "BLOCKED",
]);
export type ChangeStatus = z.infer<typeof ChangeStatusSchema>;

export const ResumeContentChangeSchema = z.object({
  id: z.string().min(1).describe("Unique identifier for this proposed change"),
  section: ChangeSectionSchema.describe("Target resume section"),
  itemId: z
    .string()
    .optional()
    .describe(
      "ID of the parent entity, e.g. experience entry ID or project ID",
    ),
  field: z
    .string()
    .min(1)
    .describe("Target field or bullet path, e.g. summary, bullets[0], title"),
  originalValue: z
    .string()
    .describe("Original text from the resume before rewrite"),
  proposedValue: z
    .string()
    .min(1)
    .describe("AI-rewritten or refined proposed text"),
  changeType: ChangeTypeSchema.describe("Classification of the change applied"),
  targetRequirementIds: z
    .array(z.string())
    .default([])
    .describe("Associated job requirement or keyword IDs targeted"),
  evidenceIds: z
    .array(z.string())
    .min(1, "Every change must trace back to at least one evidence ID")
    .describe("IDs of candidate resume evidence validating this statement"),
  rationale: z
    .string()
    .min(1)
    .describe("Explanation of why this rewrite strengthens alignment"),
  risk: ChangeRiskSchema.default("LOW").describe("Risk classification"),
  status: ChangeStatusSchema.default("PENDING").describe(
    "User review & Fact Guard approval status",
  ),
  factCheckStatus: VerificationStatusSchema.optional().default("SUPPORTED"),
  factCheckReasoning: z
    .string()
    .optional()
    .describe("Fact Guard validation assessment"),
  blockedReason: z
    .string()
    .optional()
    .describe("Specific reason if change was blocked by Fact Guard"),
  extractedClaims: z
    .array(z.string())
    .optional()
    .describe("Individual factual claims extracted from proposed value"),
});

export type ResumeContentChange = z.infer<typeof ResumeContentChangeSchema>;

export const ContentProposalSummaryStatsSchema = z.object({
  totalProposed: z.number().int().min(0),
  verifiedCount: z.number().int().min(0),
  blockedCount: z.number().int().min(0),
  uncertainCount: z.number().int().min(0),
});

export type ContentProposalSummaryStats = z.infer<
  typeof ContentProposalSummaryStatsSchema
>;

export const ContentProposalDataSchema = z.object({
  changes: z.array(ResumeContentChangeSchema),
  summaryStats: ContentProposalSummaryStatsSchema,
  generalNotes: z.string().optional(),
  targetJobTitle: z.string().optional(),
  targetCompany: z.string().optional(),
});

export type ContentProposalData = z.infer<typeof ContentProposalDataSchema>;

export const GenerateContentProposalInputSchema = z.object({
  resumeId: z.string().uuid("Invalid resume UUID"),
  jobId: z.string().uuid("Invalid job UUID"),
  matchId: z.string().uuid("Invalid match UUID").optional(),
  strategyId: z.string().uuid("Invalid strategy UUID").optional(),
});

export type GenerateContentProposalInput = z.infer<
  typeof GenerateContentProposalInputSchema
>;

export const ApplyContentProposalInputSchema = z.object({
  selectedChangeIds: z
    .array(z.string())
    .optional()
    .describe("Optional subset of approved change IDs to apply"),
});

export type ApplyContentProposalInput = z.infer<
  typeof ApplyContentProposalInputSchema
>;

export const UpdateChangeStatusInputSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

export type UpdateChangeStatusInput = z.infer<
  typeof UpdateChangeStatusInputSchema
>;

// Section Regeneration Schemas
export const RegenerateSectionInputSchema = z.object({
  resumeId: z.string().uuid("Invalid resume UUID"),
  section: ChangeSectionSchema,
  itemId: z.string().optional(),
  field: z.string().min(1, "Field path is required"),
  targetJobId: z.string().uuid("Invalid job UUID").optional(),
  instruction: z.string().max(500).optional(),
});

export type RegenerateSectionInput = z.infer<
  typeof RegenerateSectionInputSchema
>;

export const ATSCheckItemSchema = z.object({
  name: z.string(),
  passed: z.boolean(),
  feedback: z.string().optional(),
});

export type ATSCheckItem = z.infer<typeof ATSCheckItemSchema>;

export const ATSCategoryScoresSchema = z.object({
  formatting: z.number().min(0).max(15),
  readability: z.number().min(0).max(15),
  keyword: z.number().min(0).max(20),
  structure: z.number().min(0).max(15),
  evidence: z.number().min(0).max(25),
});

export type ATSCategoryScores = z.infer<typeof ATSCategoryScoresSchema>;

export const ATSValidationResultSchema = z.object({
  isAtsFriendly: z.boolean(),
  score: z.number().min(0).max(100),
  checks: z.array(ATSCheckItemSchema),
  summary: z.string(),
  categoryScores: ATSCategoryScoresSchema.optional(),
});

export type ATSValidationResult = z.infer<typeof ATSValidationResultSchema>;

export const FactualClaimCategorySchema = z.preprocess((val) => {
  if (typeof val !== "string") return "TECHNOLOGY";
  const upper = val.toUpperCase().trim().replace(/[-\s]/g, "_");
  if (upper === "METRIC") return "METRIC_OR_KPI";
  if (upper === "ROLE") return "JOB_TITLE";
  if (upper === "DOMAIN") return "RESPONSIBILITY";
  if (upper === "COMPANY" || upper === "ORGANIZATION") return "EMPLOYER";
  if (
    upper === "SKILL" ||
    upper === "LANGUAGE" ||
    upper === "LIBRARY" ||
    upper === "CLOUD_PLATFORM" ||
    upper === "CLOUD" ||
    upper === "INFRASTRUCTURE" ||
    upper === "DEVOPS"
  ) {
    return "TECHNOLOGY";
  }
  if (upper === "PROJECT") return "ACHIEVEMENT";
  return upper;
}, z.string().default("TECHNOLOGY"));

export type FactualClaimCategory = string;

export const FactualClaimSchema = z.object({
  claim: z.string().min(1, "Claim text must not be empty"),
  category: FactualClaimCategorySchema.default("TECHNOLOGY"),
  evidenceIds: z.array(z.string()).default([]),
  factCheckStatus: VerificationStatusSchema.default("SUPPORTED"),
  reason: z.string().optional(),
});

export type FactualClaim = z.infer<typeof FactualClaimSchema>;

export const SectionRegenerationOutputSchema = z.object({
  proposedValue: z.string().min(1, "Proposed value must not be empty"),
  rationale: z.string().min(1, "Rationale is required"),
  evidenceIds: z.array(z.string()).default([]),
  changeType: ChangeTypeSchema.default("REWRITE"),
  claims: z.array(FactualClaimSchema).optional().default([]),
});

export type SectionRegenerationOutput = z.infer<
  typeof SectionRegenerationOutputSchema
>;

export const SectionRegenerationResponseSchema = z.object({
  proposalId: z.string(),
  changeId: z.string(),
  originalValue: z.string(),
  proposedValue: z.string(),
  rationale: z.string(),
  evidenceIds: z.array(z.string()),
  factCheckStatus: VerificationStatusSchema,
  status: ChangeStatusSchema,
  blockedReason: z.string().optional(),
  atsChecks: ATSValidationResultSchema,
  claims: z.array(FactualClaimSchema).default([]),
  factGuardScore: z.number().min(0).max(100).default(100),
  supportedClaimsCount: z.number().int().min(0).default(0),
  unsupportedClaimsCount: z.number().int().min(0).default(0),
});

export type SectionRegenerationResponse = z.infer<
  typeof SectionRegenerationResponseSchema
>;
