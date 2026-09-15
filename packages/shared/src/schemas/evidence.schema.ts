import { z } from "zod";
import { VerificationStatus } from "../constants/index.js";

export const VerificationStatusSchema = z.enum([
  VerificationStatus.SUPPORTED,
  VerificationStatus.UNSUPPORTED,
  VerificationStatus.CONTRADICTED,
  VerificationStatus.UNCERTAIN,
]);

export const EvidenceSourceSchema = z.object({
  sourceType: z.enum([
    "ORIGINAL_RESUME",
    "USER_PROMPT",
    "USER_LINKEDIN",
    "ATTACHMENT",
    "MANUAL_ENTRY",
  ]),
  sourceIdentifier: z
    .string()
    .describe("File name, section title, or prompt input identifier"),
  rawSnippet: z
    .string()
    .describe("Exact quote or excerpt extracted from the source material"),
  confidenceScore: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence score between 0.0 and 1.0"),
});

export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;

export const ClaimEvidenceSchema = z.object({
  id: z.string().uuid().or(z.string()),
  claimText: z
    .string()
    .min(1)
    .describe(
      "The atomic factual statement extracted from resume or bullet point",
    ),
  claimCategory: z.enum([
    "EMPLOYER",
    "JOB_TITLE",
    "EMPLOYMENT_DATES",
    "METRIC_OR_KPI",
    "TOOL_OR_TECHNOLOGY",
    "RESPONSIBILITY",
    "ACHIEVEMENT",
    "EDUCATION",
    "CERTIFICATION",
    "SKILL",
  ]),
  targetSection: z
    .string()
    .describe(
      "The resume section where this claim appears, e.g., Experience: Acme Corp",
    ),
  status: VerificationStatusSchema,
  sources: z.array(EvidenceSourceSchema).default([]),
  verificationNotes: z
    .string()
    .optional()
    .describe("Reasoning provided by the Fact Guard agent"),
  suggestedCorrection: z
    .string()
    .optional()
    .describe("Proposed alternative text if unsupported or contradicted"),
});

export type ClaimEvidence = z.infer<typeof ClaimEvidenceSchema>;

export const FactCheckResultSchema = z.object({
  verified: z
    .boolean()
    .describe("True if all claims are SUPPORTED or acceptable"),
  claims: z.array(ClaimEvidenceSchema),
  totalClaimsCount: z.number(),
  supportedCount: z.number(),
  unsupportedCount: z.number(),
  contradictedCount: z.number(),
  uncertainCount: z.number(),
  summary: z.string().describe("Executive summary of fact guard review"),
});

export type FactCheckResult = z.infer<typeof FactCheckResultSchema>;
