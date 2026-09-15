import { z } from "zod";

export const RESUME_STRATEGY_VERSION = "v1";

// 1. Approval Status
export const StrategyApprovalStatusEnum = z.enum([
  "DRAFT",
  "REVIEWED",
  "APPROVED",
]);
export type StrategyApprovalStatus = z.infer<typeof StrategyApprovalStatusEnum>;

// 2. Section Strategy Actions & Section Names
export const SectionStrategyActionEnum = z.enum([
  "EMPHASIZE",
  "DE_EMPHASIZE",
  "REORDER",
  "CLARIFY",
  "REMOVE",
  "KEEP",
  "KEYWORD_ALIGNMENT",
  "REVIEW",
  "MAINTAIN",
  "CONDENSE",
  "OPTIONAL",
  "OMIT_IF_EMPTY",
]);
export type SectionStrategyAction = z.infer<typeof SectionStrategyActionEnum>;

export const SectionPriorityEnum = z.enum(["HIGH", "MEDIUM", "LOW", "NONE"]);
export type SectionPriority = z.infer<typeof SectionPriorityEnum>;

export const SectionActionItemSchema = z.object({
  action: SectionStrategyActionEnum,
  itemId: z.string().optional(),
  reason: z.string().min(1),
  targetRequirementIds: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).default("HIGH"),
  confidence: z.number().min(0).max(1).default(1.0),
});
export type SectionActionItem = z.infer<typeof SectionActionItemSchema>;

export const ResumeSectionNameEnum = z.enum([
  "personalInfo",
  "summary",
  "experience",
  "education",
  "projects",
  "skills",
  "certifications",
  "achievements",
  "languages",
  "links",
]);
export type ResumeSectionName = z.infer<typeof ResumeSectionNameEnum>;

export const SectionStrategySchema = z.object({
  section: ResumeSectionNameEnum,
  action: SectionStrategyActionEnum.optional(),
  actions: z.array(SectionActionItemSchema).default([]),
  priority: z
    .union([z.number().int().min(1).max(5), SectionPriorityEnum])
    .default("HIGH"),
  reason: z.string().min(1, "Reason is required"),
  evidence: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(1.0),
});
export type SectionStrategy = z.infer<typeof SectionStrategySchema>;

// 3. Skill Strategy
export const SkillRecommendationSchema = z.object({
  skill: z.string().min(1),
  source: z.enum(["resume", "job", "both"]).default("both"),
  reason: z.string().min(1),
  evidence: z.array(z.string()).default([]),
});
export type SkillRecommendation = z.infer<typeof SkillRecommendationSchema>;

export const MissingSkillRecommendationSchema = z.object({
  skill: z.string().min(1),
  reason: z.string().min(1),
  action: z.literal("DO_NOT_CLAIM").default("DO_NOT_CLAIM"),
  advisoryNote: z.string().optional(),
});
export type MissingSkillRecommendation = z.infer<
  typeof MissingSkillRecommendationSchema
>;

export const SkillStrategySchema = z.object({
  emphasize: z.array(SkillRecommendationSchema).default([]),
  maintain: z.array(SkillRecommendationSchema).default([]),
  deemphasize: z.array(SkillRecommendationSchema).default([]),
  missing: z.array(MissingSkillRecommendationSchema).default([]),
});
export type SkillStrategy = z.infer<typeof SkillStrategySchema>;

// 4. Keyword Strategy
export const KeywordClassificationEnum = z.enum([
  "SAFE_TO_SURFACE",
  "ALREADY_PRESENT",
  "RELATED_BUT_REQUIRES_EVIDENCE",
  "MISSING_DO_NOT_ADD",
  "LOW_VALUE",
]);
export type KeywordClassification = z.infer<typeof KeywordClassificationEnum>;

export const KeywordStrategyItemSchema = z.object({
  keyword: z.string().min(1),
  classification: KeywordClassificationEnum,
  resumeEvidence: z.array(z.string()).default([]),
  jobEvidence: z.array(z.string()).default([]),
  reason: z.string().optional(),
});
export type KeywordStrategyItem = z.infer<typeof KeywordStrategyItemSchema>;

export const KeywordNaturallyIncludeItemSchema = z.object({
  keyword: z.string().min(1),
  requirementId: z.string().optional().default(""),
  evidenceIds: z.array(z.string()).default([]),
  reason: z.string().min(1),
});
export type KeywordNaturallyIncludeItem = z.infer<
  typeof KeywordNaturallyIncludeItemSchema
>;

export const KeywordAlreadyCoveredItemSchema = z.object({
  keyword: z.string().min(1),
  evidenceIds: z.array(z.string()).default([]),
});
export type KeywordAlreadyCoveredItem = z.infer<
  typeof KeywordAlreadyCoveredItemSchema
>;

export const KeywordMissingUnsafeItemSchema = z.object({
  keyword: z.string().min(1),
  requirementId: z.string().optional().default(""),
  reason: z.string().min(1),
});
export type KeywordMissingUnsafeItem = z.infer<
  typeof KeywordMissingUnsafeItemSchema
>;

export const KeywordStrategySchema = z.object({
  keywords: z.array(KeywordStrategyItemSchema).default([]),
  mustNaturallyInclude: z.array(KeywordNaturallyIncludeItemSchema).default([]),
  alreadyCovered: z.array(KeywordAlreadyCoveredItemSchema).default([]),
  missingAndUnsafe: z.array(KeywordMissingUnsafeItemSchema).default([]),
});
export type KeywordStrategy = z.infer<typeof KeywordStrategySchema>;

// 5. Experience Strategy
export const ExperienceStrategyActionEnum = z.enum([
  "EMPHASIZE_RELEVANT_RESPONSIBILITIES",
  "EMPHASIZE_RELEVANT_TECHNOLOGIES",
  "EMPHASIZE_RELEVANT_OUTCOMES",
  "MAINTAIN",
  "CONDENSE_LESS_RELEVANT_CONTENT",
]);
export type ExperienceStrategyAction = z.infer<
  typeof ExperienceStrategyActionEnum
>;

export const ExperienceStrategyItemSchema = z.object({
  experienceId: z.string().min(1),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  priority: z.number().int().min(1).max(5),
  actions: z.array(ExperienceStrategyActionEnum).min(1),
  reason: z.string().min(1),
  evidence: z.array(z.string()).default([]),
});
export type ExperienceStrategyItem = z.infer<
  typeof ExperienceStrategyItemSchema
>;

export const ExperienceStrategySchema = z.object({
  items: z.array(ExperienceStrategyItemSchema).default([]),
});
export type ExperienceStrategy = z.infer<typeof ExperienceStrategySchema>;

// 6. Project Strategy
export const ProjectStrategyActionEnum = z.enum([
  "EMPHASIZE",
  "MAINTAIN",
  "CONDENSE",
  "DEPRIORITIZE",
]);
export type ProjectStrategyAction = z.infer<typeof ProjectStrategyActionEnum>;

export const ProjectStrategyItemSchema = z.object({
  projectId: z.string().min(1),
  projectName: z.string().optional(),
  priority: z.number().int().min(1).max(5),
  action: ProjectStrategyActionEnum,
  reason: z.string().min(1),
  evidence: z.array(z.string()).default([]),
});
export type ProjectStrategyItem = z.infer<typeof ProjectStrategyItemSchema>;

export const ProjectStrategySchema = z.object({
  items: z.array(ProjectStrategyItemSchema).default([]),
});
export type ProjectStrategy = z.infer<typeof ProjectStrategySchema>;

// 7. Gap Strategy
export const GapClassificationEnum = z.enum([
  "MISSING_REQUIRED",
  "MISSING_PREFERRED",
  "PARTIAL_MATCH",
  "EVIDENCE_WEAK",
  "UNKNOWN",
]);
export type GapClassification = z.infer<typeof GapClassificationEnum>;

export const GapStrategyItemSchema = z.object({
  requirement: z.string().min(1),
  classification: GapClassificationEnum,
  recommendation: z.string().default("DO_NOT_CLAIM"),
  reason: z.string().min(1),
  advisoryTip: z.string().optional(),
});
export type GapStrategyItem = z.infer<typeof GapStrategyItemSchema>;

export const GapStrategySchema = z.object({
  gaps: z.array(GapStrategyItemSchema).default([]),
});
export type GapStrategy = z.infer<typeof GapStrategySchema>;

// 8. Preservation Rules
export const PreservationRuleEnum = z.enum([
  "PRESERVE_EMPLOYMENT_DATES",
  "PRESERVE_EMPLOYER_NAMES",
  "PRESERVE_EDUCATION_CREDENTIALS",
  "PRESERVE_VERIFIED_CERTIFICATIONS",
  "PRESERVE_FACTUAL_METRICS",
  "PRESERVE_EXISTING_JOB_TITLES",
]);
export type PreservationRule = z.infer<typeof PreservationRuleEnum>;

export const PreservationRuleItemSchema = z.object({
  rule: PreservationRuleEnum,
  description: z.string().min(1),
});
export type PreservationRuleItem = z.infer<typeof PreservationRuleItemSchema>;

export const DEFAULT_PRESERVATION_RULES: PreservationRuleItem[] = [
  {
    rule: "PRESERVE_EMPLOYMENT_DATES",
    description:
      "Preserve exact start and end dates for all employment positions.",
  },
  {
    rule: "PRESERVE_EMPLOYER_NAMES",
    description:
      "Preserve genuine employer and company names without alteration.",
  },
  {
    rule: "PRESERVE_EDUCATION_CREDENTIALS",
    description:
      "Preserve authentic educational institutions, degrees, and GPA values.",
  },
  {
    rule: "PRESERVE_VERIFIED_CERTIFICATIONS",
    description:
      "Preserve issued certification credentials and issuing authorities.",
  },
  {
    rule: "PRESERVE_FACTUAL_METRICS",
    description:
      "Preserve quantified metrics, percentages, and dollar values from original bullets.",
  },
  {
    rule: "PRESERVE_EXISTING_JOB_TITLES",
    description:
      "Preserve candidate existing job titles without unwarranted inflation.",
  },
];

// 9. Prohibited Changes
export const ProhibitedChangeEnum = z.enum([
  "DO_NOT_INVENT_EMPLOYER",
  "DO_NOT_INVENT_JOB_TITLE",
  "DO_NOT_INVENT_DATES",
  "DO_NOT_INVENT_TECHNOLOGIES",
  "DO_NOT_INVENT_CERTIFICATIONS",
  "DO_NOT_INVENT_METRICS",
  "DO_NOT_UPGRADE_JOB_TITLE",
  "DO_NOT_CLAIM_UNSUPPORTED_SKILL",
  "DO_NOT_CLAIM_UNSUPPORTED_EXPERIENCE",
  "DO_NOT_CREATE_FAKE_ACHIEVEMENTS",
]);
export type ProhibitedChange = z.infer<typeof ProhibitedChangeEnum>;

export const ProhibitedChangeItemSchema = z.object({
  rule: ProhibitedChangeEnum,
  reason: z.string().min(1),
});
export type ProhibitedChangeItem = z.infer<typeof ProhibitedChangeItemSchema>;

export const DEFAULT_PROHIBITED_CHANGES: ProhibitedChangeItem[] = [
  {
    rule: "DO_NOT_INVENT_EMPLOYER",
    reason: "Fabricating employment history violates verification integrity.",
  },
  {
    rule: "DO_NOT_INVENT_JOB_TITLE",
    reason: "Job titles must reflect actual held roles.",
  },
  {
    rule: "DO_NOT_INVENT_DATES",
    reason: "Tenure dates must match verifiable employment history.",
  },
  {
    rule: "DO_NOT_INVENT_TECHNOLOGIES",
    reason:
      "Only technologies evidenced in candidate source material may be claimed.",
  },
  {
    rule: "DO_NOT_INVENT_CERTIFICATIONS",
    reason: "Credentials must correspond to authentic earned certificates.",
  },
  {
    rule: "DO_NOT_INVENT_METRICS",
    reason: "Performance metrics and percentages must not be manufactured.",
  },
  {
    rule: "DO_NOT_UPGRADE_JOB_TITLE",
    reason: "Titles must not be inflated to meet senior role requirements.",
  },
  {
    rule: "DO_NOT_CLAIM_UNSUPPORTED_SKILL",
    reason:
      "Skills not present in source resume must remain unstated or flagged as absent.",
  },
  {
    rule: "DO_NOT_CLAIM_UNSUPPORTED_EXPERIENCE",
    reason: "Responsibilities not evidenced in history must not be claimed.",
  },
  {
    rule: "DO_NOT_CREATE_FAKE_ACHIEVEMENTS",
    reason:
      "All awards and achievements must originate from genuine candidate background.",
  },
];

// 10. Strategy Evidence
export const StrategyEvidenceSchema = z.object({
  strategyItemId: z.string().min(1),
  sourceType: z.enum(["RESUME", "JOB", "MATCH"]),
  sourceId: z.string().min(1),
  excerpt: z.string().optional(),
  relationship: z.enum(["SUPPORTS", "CONTRADICTS", "REQUIRES_VERIFICATION"]),
  confidence: z.number().min(0).max(1).default(1.0),
});
export type StrategyEvidence = z.infer<typeof StrategyEvidenceSchema>;

// 11. Overview, Requirement Strategy, Risk Flags, and Protected Facts
export const OverviewStrategySchema = z.object({
  objective: z.string().default("Tailor resume for target role"),
  overallApproach: z.string().min(5),
  prioritySummary: z
    .string()
    .default("Align skills and experience with key job requirements"),
});
export type OverviewStrategy = z.infer<typeof OverviewStrategySchema>;

export const RequirementStatusEnum = z.enum([
  "MATCHED",
  "PARTIAL",
  "MISSING",
  "NOT_APPLICABLE",
  "UNKNOWN",
]);
export type RequirementStatus = z.infer<typeof RequirementStatusEnum>;

export const RequirementStrategyActionEnum = z.enum([
  "EMPHASIZE_EXISTING_EVIDENCE",
  "CLARIFY_EXISTING_EVIDENCE",
  "REPOSITION_EXISTING_EVIDENCE",
  "NO_ACTION",
  "DO_NOT_INVENT",
  "REVIEW_MANUALLY",
]);
export type RequirementStrategyAction = z.infer<
  typeof RequirementStrategyActionEnum
>;

export const RequirementStrategyItemSchema = z.object({
  requirementId: z.string().min(1),
  status: RequirementStatusEnum,
  strategy: RequirementStrategyActionEnum,
  evidenceIds: z.array(z.string()).default([]),
  reason: z.string().min(1),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
});
export type RequirementStrategyItem = z.infer<
  typeof RequirementStrategyItemSchema
>;

export const RiskFlagTypeEnum = z.enum([
  "MISSING_EVIDENCE",
  "AMBIGUOUS_EVIDENCE",
  "POTENTIAL_OVERCLAIM",
  "KEYWORD_STUFFING_RISK",
  "CONTRADICTION",
  "INSUFFICIENT_CONTEXT",
]);
export type RiskFlagType = z.infer<typeof RiskFlagTypeEnum>;

export const RiskFlagSchema = z.object({
  type: RiskFlagTypeEnum,
  description: z.string().min(1),
  evidenceIds: z.array(z.string()).default([]),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
});
export type RiskFlag = z.infer<typeof RiskFlagSchema>;

export const ProtectedFactSchema = z.object({
  field: z.string().min(1),
  value: z.string().min(1),
  evidenceIds: z.array(z.string()).default([]),
  reason: z.string().min(1),
});
export type ProtectedFact = z.infer<typeof ProtectedFactSchema>;

// 12. Complete ResumeStrategy Schema
export const ResumeStrategySchema = z.object({
  id: z.string().optional(),
  resumeId: z.string().uuid(),
  jobId: z.string().uuid(),
  matchId: z.string().uuid().optional().nullable(),

  strategyVersion: z.string().default(RESUME_STRATEGY_VERSION),
  status: StrategyApprovalStatusEnum.default("DRAFT"),

  overview: OverviewStrategySchema.optional(),
  overallApproach: z
    .string()
    .min(10, "Overall approach must be at least 10 characters"),

  sectionStrategies: z.array(SectionStrategySchema).default([]),
  skillStrategy: SkillStrategySchema,
  keywordStrategy: KeywordStrategySchema,
  experienceStrategy: ExperienceStrategySchema,
  projectStrategy: ProjectStrategySchema,
  gapStrategy: GapStrategySchema,

  requirementStrategy: z.array(RequirementStrategyItemSchema).default([]),
  riskFlags: z.array(RiskFlagSchema).default([]),
  protectedFacts: z.array(ProtectedFactSchema).default([]),

  preservationRules: z
    .array(PreservationRuleItemSchema)
    .default(DEFAULT_PRESERVATION_RULES),
  prohibitedChanges: z
    .array(ProhibitedChangeItemSchema)
    .default(DEFAULT_PROHIBITED_CHANGES),

  evidence: z.array(StrategyEvidenceSchema).default([]),
  confidence: z.number().min(0).max(1).default(0.95),

  // Snapshot timestamps & stale tracking
  resumeUpdatedAt: z.string().nullable().optional(),
  jobUpdatedAt: z.string().nullable().optional(),
  matchUpdatedAt: z.string().nullable().optional(),
  isStale: z.boolean().default(false),

  generatedAt: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type ResumeStrategy = z.infer<typeof ResumeStrategySchema>;

// 12. API Request / Response Schemas
export const CreateStrategyRequestSchema = z.object({
  resumeId: z.string().uuid("Invalid resumeId format"),
  jobId: z.string().uuid("Invalid jobId format"),
  matchId: z.string().uuid("Invalid matchId format").optional(),
});
export type CreateStrategyRequest = z.infer<typeof CreateStrategyRequestSchema>;

export const UpdateStrategyStatusRequestSchema = z.object({
  status: StrategyApprovalStatusEnum,
});
export type UpdateStrategyStatusRequest = z.infer<
  typeof UpdateStrategyStatusRequestSchema
>;
