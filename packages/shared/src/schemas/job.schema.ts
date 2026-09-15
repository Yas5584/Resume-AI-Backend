import { z } from "zod";

// Size limit constants
export const MIN_JOB_DESCRIPTION_CHARS = 50;
export const MAX_JOB_DESCRIPTION_CHARS = 30000;

// Seniority Enum
export const SeniorityEnum = z.enum([
  "INTERN",
  "ENTRY_LEVEL",
  "JUNIOR",
  "MID_LEVEL",
  "SENIOR",
  "LEAD",
  "STAFF",
  "PRINCIPAL",
  "MANAGER",
  "DIRECTOR",
  "VP",
  "EXECUTIVE",
  "UNKNOWN",
]);
export type Seniority = z.infer<typeof SeniorityEnum>;

// Requirement Category Enum
export const RequirementCategoryEnum = z.enum([
  "REQUIRED_SKILL",
  "PREFERRED_SKILL",
  "RESPONSIBILITY",
  "EXPERIENCE",
  "EDUCATION",
  "CERTIFICATION",
  "DOMAIN_KNOWLEDGE",
  "SOFT_SKILL",
  "TOOL",
  "PLATFORM",
  "LANGUAGE",
  "LOCATION",
  "WORK_AUTHORIZATION",
  "OTHER",
]);
export type RequirementCategory = z.infer<typeof RequirementCategoryEnum>;

// Requirement Importance Enum
export const RequirementImportanceEnum = z.enum([
  "REQUIRED",
  "PREFERRED",
  "NICE_TO_HAVE",
  "UNKNOWN",
]);
export type RequirementImportance = z.infer<typeof RequirementImportanceEnum>;

// Work Arrangement Enum
export const WorkArrangementEnum = z.enum([
  "REMOTE",
  "HYBRID",
  "ONSITE",
  "UNKNOWN",
]);
export type WorkArrangement = z.infer<typeof WorkArrangementEnum>;

// Requirement Relationship Enum
export const RequirementRelationshipEnum = z.enum(["AND", "OR", "OPTIONAL"]);
export type RequirementRelationship = z.infer<
  typeof RequirementRelationshipEnum
>;

// Keyword Category Enum
export const KeywordCategoryEnum = z.enum([
  "TECHNICAL",
  "DOMAIN",
  "ROLE",
  "TOOL",
  "PLATFORM",
  "SOFT_SKILL",
  "CERTIFICATION",
  "EDUCATION",
  "INDUSTRY",
]);
export type KeywordCategory = z.infer<typeof KeywordCategoryEnum>;

// Keyword Schema
export const JobKeywordSchema = z.object({
  keyword: z.string().min(1, "Keyword must not be empty"),
  category: KeywordCategoryEnum.or(z.string()).default("TECHNICAL"),
  importance: RequirementImportanceEnum.default("REQUIRED"),
  frequency: z.number().int().min(1, "Frequency must be at least 1").default(1),
  evidence: z.string().default(""),
  confidence: z
    .number()
    .min(0, "Confidence must be >= 0")
    .max(1, "Confidence must be <= 1")
    .default(1.0),
});
export type JobKeyword = z.infer<typeof JobKeywordSchema>;

// Skill Requirement Schema
export const SkillRequirementSchema = z.object({
  name: z.string().min(1, "Skill name is required"),
  normalizedName: z.string().min(1, "Normalized skill name is required"),
  category: RequirementCategoryEnum.or(z.string()).default("REQUIRED_SKILL"),
  importance: RequirementImportanceEnum.default("REQUIRED"),
  explicit: z.boolean().default(true),
  evidence: z.string().default(""),
  confidence: z
    .number()
    .min(0, "Confidence must be >= 0")
    .max(1, "Confidence must be <= 1")
    .default(1.0),
});
export type SkillRequirement = z.infer<typeof SkillRequirementSchema>;

// Responsibility Schema
export const ResponsibilitySchema = z.object({
  text: z.string().min(1, "Responsibility text is required"),
  importance: RequirementImportanceEnum.default("REQUIRED"),
  evidence: z.string().default(""),
  confidence: z
    .number()
    .min(0, "Confidence must be >= 0")
    .max(1, "Confidence must be <= 1")
    .default(1.0),
});
export type Responsibility = z.infer<typeof ResponsibilitySchema>;

// Unified Requirement Schema
export const RequirementSchema = z.object({
  text: z.string().min(1, "Requirement text is required"),
  category: RequirementCategoryEnum.default("OTHER"),
  importance: RequirementImportanceEnum.default("REQUIRED"),
  explicit: z.boolean().default(true),
  evidence: z.string().default(""),
  confidence: z
    .number()
    .min(0, "Confidence must be >= 0")
    .max(1, "Confidence must be <= 1")
    .default(1.0),
  relationship: RequirementRelationshipEnum.optional().nullable(),
  relatedRequirements: z.array(z.string()).default([]),
});
export type Requirement = z.infer<typeof RequirementSchema>;

// Experience Requirement Schema
export const ExperienceRequirementSchema = z.object({
  yearsMin: z.number().min(0).nullable().default(null),
  yearsMax: z.number().min(0).nullable().default(null),
  domain: z.string().nullable().default(null),
  management: z.boolean().default(false),
  importance: RequirementImportanceEnum.default("REQUIRED"),
  explicit: z.boolean().default(true),
  evidence: z.string().default(""),
  confidence: z
    .number()
    .min(0, "Confidence must be >= 0")
    .max(1, "Confidence must be <= 1")
    .default(1.0),
});
export type ExperienceRequirement = z.infer<typeof ExperienceRequirementSchema>;

// Education Requirement Schema
export const EducationRequirementSchema = z.object({
  degree: z.string().nullable().default(null),
  field: z.string().nullable().default(null),
  minimum: z.boolean().default(true),
  preferred: z.boolean().default(false),
  importance: RequirementImportanceEnum.default("REQUIRED"),
  explicit: z.boolean().default(true),
  evidence: z.string().default(""),
  confidence: z
    .number()
    .min(0, "Confidence must be >= 0")
    .max(1, "Confidence must be <= 1")
    .default(1.0),
});
export type EducationRequirement = z.infer<typeof EducationRequirementSchema>;

// Certification Requirement Schema
export const CertificationRequirementSchema = z.object({
  name: z.string().min(1, "Certification name is required"),
  importance: RequirementImportanceEnum.default("REQUIRED"),
  explicit: z.boolean().default(true),
  evidence: z.string().default(""),
  confidence: z
    .number()
    .min(0, "Confidence must be >= 0")
    .max(1, "Confidence must be <= 1")
    .default(1.0),
});
export type CertificationRequirement = z.infer<
  typeof CertificationRequirementSchema
>;

// Comprehensive Structured Job Analysis Schema
export const JobAnalysisSchema = z.object({
  jobTitle: z.string().nullable().default(null),
  company: z.string().nullable().default(null),
  seniority: SeniorityEnum.default("UNKNOWN"),
  summary: z.string().nullable().default(null),

  responsibilities: z.array(ResponsibilitySchema).default([]),
  requirements: z.array(RequirementSchema).default([]),
  skills: z.array(SkillRequirementSchema).default([]),
  education: z.array(EducationRequirementSchema).default([]),
  certifications: z.array(CertificationRequirementSchema).default([]),
  experience: z.array(ExperienceRequirementSchema).default([]),
  keywords: z.array(JobKeywordSchema).default([]),

  workArrangement: WorkArrangementEnum.nullable().default(null),
  location: z.string().nullable().default(null),
  industry: z.string().nullable().default(null),
  workAuthorization: z.string().nullable().default(null),

  // Convenience / backward compatibility fields
  roleSummary: z.string().optional(),
  requiredSkills: z.array(z.string()).optional(),
  preferredSkills: z.array(z.string()).optional(),
  coreResponsibilities: z.array(z.string()).optional(),
  domainKeywords: z.array(z.string()).optional(),
  seniorityLevel: z.string().optional(),
  educationRequirements: z.string().optional(),
  experienceYearsMinimum: z.number().optional(),
});

export type JobAnalysis = z.infer<typeof JobAnalysisSchema>;

// Phase 7: Resume ↔ Job Matching & Transparent Match Analysis Schemas
export const MATCH_SCORE_VERSION = "v1";

export const DEFAULT_MATCH_SCORE_WEIGHTS = {
  requiredRequirements: 40,
  preferredSkills: 15,
  experience: 20,
  responsibilities: 10,
  education: 5,
  certifications: 5,
  keywords: 5,
  // Combined skills weight alias for backward compatibility (40 + 15 = 55)
  skills: 55,
} as const;

export const MatchComponentSchema = z.object({
  score: z.number().min(0).max(100),
  weight: z.number().min(0).max(100),
  weightedScore: z.number().min(0).max(100),
  matchedCount: z.number().int().min(0),
  totalCount: z.number().int().min(0),
  details: z.string().optional(),
});
export type MatchComponent = z.infer<typeof MatchComponentSchema>;

export const MatchItemStateEnum = z.enum([
  "MATCHED",
  "PARTIAL",
  "MISSING",
  "UNKNOWN",
]);
export type MatchItemState = z.infer<typeof MatchItemStateEnum>;

export const MatchedSkillItemSchema = z.object({
  skill: z.string(),
  normalizedSkill: z.string(),
  importance: RequirementImportanceEnum.default("REQUIRED"),
  matchType: MatchItemStateEnum,
  resumeEvidence: z.array(z.string()).default([]),
  jobEvidence: z.string().optional(),
  confidence: z.number().min(0).max(1).default(1.0),
  reason: z.string().optional(),
});
export type MatchedSkillItem = z.infer<typeof MatchedSkillItemSchema>;

export const MatchedRequirementItemSchema = z.object({
  requirement: z.string(),
  importance: RequirementImportanceEnum.default("REQUIRED"),
  matchType: MatchItemStateEnum,
  resumeEvidence: z.array(z.string()).default([]),
  jobEvidence: z.string().optional(),
  confidence: z.number().min(0).max(1).default(1.0),
  relationship: RequirementRelationshipEnum.default("OPTIONAL"),
  reason: z.string().optional(),
});
export type MatchedRequirementItem = z.infer<
  typeof MatchedRequirementItemSchema
>;

export const MatchStrengthSchema = z.object({
  title: z.string(),
  detail: z.string(),
  evidence: z.array(z.string()).default([]),
  category: z.string().default("TECHNICAL"),
});
export type MatchStrength = z.infer<typeof MatchStrengthSchema>;

export const MatchGapSchema = z.object({
  title: z.string(),
  detail: z.string(),
  importance: RequirementImportanceEnum.default("REQUIRED"),
  missingType: z
    .enum([
      "SKILL",
      "EXPERIENCE",
      "EDUCATION",
      "CERTIFICATION",
      "KEYWORD",
      "RESPONSIBILITY",
    ])
    .default("SKILL"),
  critical: z.boolean().default(false),
  remedyHint: z.string().optional(),
});
export type MatchGap = z.infer<typeof MatchGapSchema>;

export const MatchRecommendationSchema = z.object({
  title: z.string(),
  description: z.string(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  actionable: z.boolean().default(true),
});
export type MatchRecommendation = z.infer<typeof MatchRecommendationSchema>;

export const MatchScoreLabelEnum = z.enum([
  "Strong Match",
  "Good Match",
  "Moderate Match",
  "Weak Match",
  "Low Match",
]);
export type MatchScoreLabel = z.infer<typeof MatchScoreLabelEnum>;

export function getMatchScoreLabel(score: number): MatchScoreLabel {
  if (score >= 90) return "Strong Match";
  if (score >= 75) return "Good Match";
  if (score >= 60) return "Moderate Match";
  if (score >= 40) return "Weak Match";
  return "Low Match";
}

// Comprehensive Match Analysis Schema
export const MatchAnalysisSchema = z.object({
  scoreVersion: z.string().default(MATCH_SCORE_VERSION),
  overallScore: z
    .number()
    .min(0)
    .max(100)
    .describe("Deterministic normalized compatibility score from 0 to 100"),
  scoreLabel: MatchScoreLabelEnum.default("Moderate Match"),

  // Component Subscores (Weights: Required: 40%, Preferred: 15%, Experience: 20%, Responsibilities: 10%, Education: 5%, Certifications: 5%, Keywords: 5%)
  requiredRequirementsMatch: MatchComponentSchema.optional(),
  preferredSkillsMatch: MatchComponentSchema.optional(),
  skillMatch: MatchComponentSchema,
  experienceMatch: MatchComponentSchema,
  responsibilityAlignment: MatchComponentSchema,
  keywordCoverage: MatchComponentSchema,
  educationMatch: MatchComponentSchema,
  certificationMatch: MatchComponentSchema,

  // Granular item lists
  matchedSkills: z.array(MatchedSkillItemSchema).default([]),
  missingSkills: z.array(MatchedSkillItemSchema).default([]),
  partialSkills: z.array(MatchedSkillItemSchema).default([]),

  matchedRequirements: z.array(MatchedRequirementItemSchema).default([]),
  missingRequirements: z.array(MatchedRequirementItemSchema).default([]),

  // Actionable findings
  strengths: z.array(MatchStrengthSchema).default([]),
  gaps: z.array(MatchGapSchema).default([]),
  recommendations: z.array(MatchRecommendationSchema).default([]),

  // Snapshot timestamps & stale detection
  resumeUpdatedAt: z.string().nullable().optional(),
  jobUpdatedAt: z.string().nullable().optional(),
  isStale: z.boolean().default(false),

  // Backward compatibility fields
  hardSkillsMatchScore: z.number().min(0).max(100).optional(),
  experienceMatchScore: z.number().min(0).max(100).optional(),
  tailoringRecommendations: z.array(z.string()).default([]),
});

export type MatchAnalysis = z.infer<typeof MatchAnalysisSchema>;
