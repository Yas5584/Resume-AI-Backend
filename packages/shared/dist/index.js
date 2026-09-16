// packages/shared/src/constants/index.ts
var VerificationStatus = {
  SUPPORTED: "SUPPORTED",
  UNSUPPORTED: "UNSUPPORTED",
  CONTRADICTED: "CONTRADICTED",
  UNCERTAIN: "UNCERTAIN"
};
var WorkflowStatus = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED"
};
var WorkflowType = {
  CREATE_RESUME: "CREATE_RESUME",
  JOB_TAILORING: "JOB_TAILORING",
  RESUME_REVIEW: "RESUME_REVIEW"
};
var AgentName = {
  INTAKE: "IntakeAgent",
  RESUME_PARSER: "ResumeParserAgent",
  JOB_ANALYZER: "JobAnalyzerAgent",
  MATCHER: "MatcherAgent",
  STRATEGY: "StrategyAgent",
  CONTENT_WRITER: "ContentWriterAgent",
  FACT_GUARD: "FactGuardAgent",
  ATS_ANALYZER: "ATSAnalyzerAgent",
  QUALITY_REVIEWER: "QualityReviewerAgent"
};
var ErrorCode = {
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
  PARSER_POSSIBLE_DATA_LOSS: "PARSER_POSSIBLE_DATA_LOSS"
};
var SubscriptionTier = {
  FREE: "FREE",
  PRO: "PRO",
  ENTERPRISE: "ENTERPRISE"
};

// packages/shared/src/schemas/resume.schema.ts
import { z } from "zod";
function generateId() {
  return Math.random().toString(36).substring(2, 11);
}
var SafeUrlSchema = z.preprocess((val) => {
  if (val === null || val === void 0) return "";
  if (typeof val !== "string") return String(val);
  const trimmed = val.trim();
  if (!trimmed || trimmed.toLowerCase() === "n/a" || trimmed.toLowerCase() === "none") {
    return "";
  }
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return "";
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("github.com/") || trimmed.startsWith("linkedin.com/")) {
    return `https://${trimmed}`;
  }
  if (trimmed.includes(".") && !trimmed.includes(" ") && !trimmed.includes("@")) {
    return `https://${trimmed}`;
  }
  return trimmed;
}, z.string().default(""));
var PersonalInfoSchema = z.object({
  fullName: z.preprocess(
    (v) => v === null || v === void 0 ? "" : String(v),
    z.string().default("")
  ),
  headline: z.preprocess(
    (v) => v === null || v === void 0 ? "" : String(v),
    z.string().optional().default("")
  ),
  email: z.preprocess(
    (v) => v === null || v === void 0 ? "" : String(v).trim(),
    z.string().optional().default("")
  ),
  phone: z.preprocess(
    (v) => v === null || v === void 0 ? "" : String(v),
    z.string().optional().default("")
  ),
  location: z.preprocess(
    (v) => v === null || v === void 0 ? "" : String(v),
    z.string().optional().default("")
  ),
  website: SafeUrlSchema,
  linkedin: SafeUrlSchema,
  github: SafeUrlSchema,
  linkedinUrl: SafeUrlSchema,
  githubUrl: SafeUrlSchema,
  portfolioUrl: SafeUrlSchema
});
var ContactInfoSchema = PersonalInfoSchema;
var StringArraySchema = z.preprocess((val) => {
  if (val === null || val === void 0) return [];
  if (typeof val === "string") return val.split("\n").map((s) => s.trim()).filter(Boolean);
  if (Array.isArray(val)) return val.map((item) => typeof item === "string" ? item : JSON.stringify(item));
  return [];
}, z.array(z.string()).default([]));
var ensureArray = (itemSchema) => z.preprocess((val) => {
  if (val === null || val === void 0) return [];
  if (Array.isArray(val)) return val;
  return [val];
}, z.array(itemSchema).default([]));
var WorkExperienceSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    return {
      jobTitle: val.slice(0, 100),
      company: "Company",
      description: val,
      bullets: [val]
    };
  }
  if (val && typeof val === "object") {
    const obj = { ...val };
    const title = obj.jobTitle || obj.position || obj.title || obj.role || "Role";
    obj.jobTitle = title;
    obj.position = obj.position || title;
    if (!obj.company && (obj.organization || obj.employer)) {
      obj.company = obj.organization || obj.employer;
    }
    return obj;
  }
  return val;
}, z.object({
  id: z.string().default(generateId),
  jobTitle: z.preprocess((v) => v === null || v === void 0 ? "Role" : String(v), z.string().default("Role")),
  position: z.preprocess((v) => v === null || v === void 0 ? "" : String(v), z.string().optional().default("")),
  company: z.preprocess((v) => v === null || v === void 0 ? "Company" : String(v), z.string().default("Company")),
  location: z.preprocess((v) => v === null || v === void 0 ? "" : String(v), z.string().optional().default("")),
  employmentType: z.preprocess((v) => v === null || v === void 0 ? "Full-time" : String(v), z.string().optional().default("Full-time")),
  startDate: z.preprocess((v) => v === null || v === void 0 ? "" : String(v), z.string().default("")),
  endDate: z.preprocess((v) => v === null || v === void 0 ? "" : String(v), z.string().optional().default("")),
  current: z.preprocess((v) => Boolean(v), z.boolean().default(false)),
  description: z.preprocess((v) => v === null || v === void 0 ? "" : String(v), z.string().optional().default("")),
  bullets: StringArraySchema,
  technologiesUsed: StringArraySchema
}));
var EducationSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    return {
      institution: val,
      degree: "Degree",
      description: val
    };
  }
  if (val && typeof val === "object") {
    const obj = { ...val };
    if (!obj.institution && (obj.school || obj.university || obj.college)) {
      obj.institution = obj.school || obj.university || obj.college;
    }
    if (!obj.degree && (obj.qualification || obj.studyField || obj.program)) {
      obj.degree = obj.qualification || obj.studyField || obj.program;
    }
    return obj;
  }
  return val;
}, z.object({
  id: z.string().default(generateId),
  institution: z.preprocess((v) => v === null || v === void 0 ? "Institution" : String(v), z.string().default("Institution")),
  degree: z.preprocess((v) => v === null || v === void 0 ? "Degree" : String(v), z.string().default("Degree")),
  fieldOfStudy: z.preprocess((v) => v === null || v === void 0 ? "" : String(v), z.string().optional().default("")),
  location: z.preprocess((v) => v === null || v === void 0 ? "" : String(v), z.string().optional().default("")),
  startDate: z.preprocess((v) => v === null || v === void 0 ? "" : String(v), z.string().optional().default("")),
  endDate: z.preprocess((v) => v === null || v === void 0 ? "" : String(v), z.string().optional().default("")),
  current: z.preprocess((v) => Boolean(v), z.boolean().default(false)),
  gpa: z.preprocess((v) => v === null || v === void 0 ? "" : String(v), z.string().optional().default("")),
  description: z.preprocess((v) => v === null || v === void 0 ? "" : String(v), z.string().optional().default("")),
  honors: StringArraySchema
}));
var ProjectSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    return {
      name: val.slice(0, 100),
      description: val,
      bullets: [val]
    };
  }
  if (val && typeof val === "object") {
    const obj = { ...val };
    if (!obj.name && (obj.title || obj.projectName)) {
      obj.name = obj.title || obj.projectName;
    }
    return obj;
  }
  return val;
}, z.object({
  id: z.string().default(generateId),
  name: z.preprocess((v) => v === null || v === void 0 ? "Project" : String(v), z.string().default("Project")),
  description: z.preprocess((v) => v === null || v === void 0 ? "" : String(v), z.string().default("")),
  role: z.preprocess((v) => v === null || v === void 0 ? "" : String(v), z.string().optional().default("")),
  technologies: StringArraySchema,
  startDate: z.preprocess((v) => v === null || v === void 0 ? "" : String(v), z.string().optional().default("")),
  endDate: z.preprocess((v) => v === null || v === void 0 ? "" : String(v), z.string().optional().default("")),
  url: SafeUrlSchema,
  repoUrl: SafeUrlSchema,
  bullets: StringArraySchema,
  highlights: StringArraySchema
}));
var SkillCategorySchema = z.preprocess((val) => {
  if (typeof val === "string") {
    return {
      category: "Skills",
      skills: [val]
    };
  }
  if (val && typeof val === "object") {
    const obj = { ...val };
    if (!obj.category && (obj.name || obj.group || obj.title)) {
      obj.category = obj.name || obj.group || obj.title;
    }
    return obj;
  }
  return val;
}, z.object({
  id: z.string().default(generateId),
  category: z.preprocess((v) => v === null || v === void 0 ? "Skills" : String(v), z.string().default("Skills")),
  skills: StringArraySchema
}));
var SkillsArraySchema = z.preprocess((val) => {
  if (!val) return [];
  if (Array.isArray(val)) {
    if (val.length > 0 && typeof val[0] === "string") {
      return [{ category: "Skills", skills: val }];
    }
    return val;
  }
  if (typeof val === "object") {
    return Object.entries(val).map(([cat, sks]) => ({
      category: cat,
      skills: Array.isArray(sks) ? sks : [String(sks)]
    }));
  }
  return [];
}, z.array(SkillCategorySchema).default([]));
var CertificationSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    return {
      name: val,
      issuer: "Issuer"
    };
  }
  if (val && typeof val === "object") {
    const obj = { ...val };
    if (!obj.name && (obj.title || obj.certificationName)) {
      obj.name = obj.title || obj.certificationName;
    }
    if (!obj.issuer && (obj.organization || obj.authority || obj.issuingOrganization)) {
      obj.issuer = obj.organization || obj.authority || obj.issuingOrganization;
    }
    return obj;
  }
  return val;
}, z.object({
  id: z.string().default(generateId),
  name: z.preprocess((v) => v === null || v === void 0 ? "Certification" : String(v), z.string().default("Certification")),
  issuer: z.preprocess((v) => v === null || v === void 0 ? "Issuer" : String(v), z.string().default("Issuer")),
  issueDate: z.preprocess((v) => v === null || v === void 0 ? "" : String(v), z.string().optional().default("")),
  expirationDate: z.preprocess((v) => v === null || v === void 0 ? "" : String(v), z.string().optional().default("")),
  credentialId: z.preprocess((v) => v === null || v === void 0 ? "" : String(v), z.string().optional().default("")),
  credentialUrl: SafeUrlSchema
}));
var AchievementSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    return {
      title: val,
      description: ""
    };
  }
  if (val && typeof val === "object") {
    const obj = { ...val };
    if (!obj.title && (obj.name || obj.award)) {
      obj.title = obj.name || obj.award;
    }
    return obj;
  }
  return val;
}, z.object({
  id: z.string().default(generateId),
  title: z.preprocess((v) => v === null || v === void 0 ? "Achievement" : String(v), z.string().default("Achievement")),
  description: z.preprocess((v) => v === null || v === void 0 ? "" : String(v), z.string().optional().default("")),
  date: z.preprocess((v) => v === null || v === void 0 ? "" : String(v), z.string().optional().default(""))
}));
var LanguageProficiencyEnum = z.enum([
  "Basic",
  "Conversational",
  "Professional",
  "Fluent",
  "Native"
]);
var LanguageSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    return {
      language: val,
      proficiency: "Conversational"
    };
  }
  if (val && typeof val === "object") {
    const obj = { ...val };
    if (!obj.language && (obj.name || obj.lang)) {
      obj.language = obj.name || obj.lang;
    }
    return obj;
  }
  return val;
}, z.object({
  id: z.string().default(generateId),
  language: z.preprocess((v) => v === null || v === void 0 ? "" : String(v), z.string().default("")),
  proficiency: z.preprocess((val) => {
    if (typeof val !== "string") return "Conversational";
    const normalized = val.trim().toLowerCase();
    if (normalized.includes("native") || normalized.includes("mother")) return "Native";
    if (normalized.includes("fluent")) return "Fluent";
    if (normalized.includes("prof") || normalized.includes("advance")) return "Professional";
    if (normalized.includes("inter") || normalized.includes("conversa")) return "Conversational";
    if (normalized.includes("basic") || normalized.includes("element") || normalized.includes("beginner")) return "Basic";
    return "Conversational";
  }, LanguageProficiencyEnum.default("Conversational"))
}));
var CustomLinkSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    return {
      label: val,
      url: val
    };
  }
  if (val && typeof val === "object") {
    const obj = { ...val };
    if (!obj.label && (obj.name || obj.title || obj.platform)) {
      obj.label = obj.name || obj.title || obj.platform;
    }
    return obj;
  }
  return val;
}, z.object({
  id: z.string().default(generateId),
  label: z.preprocess((v) => v === null || v === void 0 ? "Link" : String(v), z.string().default("Link")),
  url: SafeUrlSchema
}));
var SectionVisibilitySchema = z.object({
  showSummary: z.boolean().default(true),
  showExperience: z.boolean().default(true),
  showEducation: z.boolean().default(true),
  showProjects: z.boolean().default(true),
  showSkills: z.boolean().default(true),
  showCertifications: z.boolean().default(true),
  showAchievements: z.boolean().default(true),
  showLanguages: z.boolean().default(true),
  showLinks: z.boolean().default(true)
});
var DEFAULT_SECTION_ORDER = [
  "summary",
  "experience",
  "education",
  "projects",
  "skills",
  "certifications",
  "achievements",
  "languages",
  "links"
];
var ResumeDataSchema = z.object({
  personalInfo: PersonalInfoSchema.default({}),
  summary: z.preprocess((v) => v === null || v === void 0 ? "" : String(v), z.string().default("")),
  experience: ensureArray(WorkExperienceSchema),
  education: ensureArray(EducationSchema),
  projects: ensureArray(ProjectSchema),
  skills: SkillsArraySchema,
  certifications: ensureArray(CertificationSchema),
  achievements: ensureArray(AchievementSchema),
  languages: ensureArray(LanguageSchema),
  links: ensureArray(CustomLinkSchema),
  sectionVisibility: SectionVisibilitySchema.default({}),
  sectionOrder: z.preprocess(
    (v) => Array.isArray(v) && v.length > 0 ? v : DEFAULT_SECTION_ORDER,
    z.array(z.string()).default(DEFAULT_SECTION_ORDER)
  )
});
var ResumeSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  title: z.string().min(1, "Resume title is required").default("My Resume"),
  targetRole: z.string().optional().default(""),
  currentTemplateId: z.string().optional().default("modern-standard"),
  contact: PersonalInfoSchema.optional(),
  personalInfo: PersonalInfoSchema.optional(),
  summary: z.string().default(""),
  experience: z.array(WorkExperienceSchema).default([]),
  education: z.array(EducationSchema).default([]),
  skills: z.array(SkillCategorySchema).default([]),
  projects: z.array(ProjectSchema).default([]),
  certifications: z.array(CertificationSchema).default([]),
  achievements: z.array(AchievementSchema).default([]),
  languages: z.array(LanguageSchema).default([]),
  links: z.array(CustomLinkSchema).default([]),
  customSections: z.array(
    z.object({
      heading: z.string(),
      items: z.array(z.string())
    })
  ).default([]),
  sectionVisibility: SectionVisibilitySchema.default({}),
  sectionOrder: z.array(z.string()).default(DEFAULT_SECTION_ORDER),
  resumeData: ResumeDataSchema.optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});
function createDefaultResumeData(fullName = "") {
  return {
    personalInfo: {
      fullName,
      headline: "",
      email: "",
      phone: "",
      location: "",
      website: "",
      linkedin: "",
      github: "",
      linkedinUrl: "",
      githubUrl: "",
      portfolioUrl: ""
    },
    summary: "",
    experience: [],
    education: [],
    projects: [],
    skills: [],
    certifications: [],
    achievements: [],
    languages: [],
    links: [],
    sectionVisibility: {
      showSummary: true,
      showExperience: true,
      showEducation: true,
      showProjects: true,
      showSkills: true,
      showCertifications: true,
      showAchievements: true,
      showLanguages: true,
      showLinks: true
    },
    sectionOrder: [...DEFAULT_SECTION_ORDER]
  };
}

// packages/shared/src/schemas/job.schema.ts
import { z as z2 } from "zod";
var MIN_JOB_DESCRIPTION_CHARS = 50;
var MAX_JOB_DESCRIPTION_CHARS = 3e4;
var SeniorityEnum = z2.enum([
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
  "UNKNOWN"
]);
var RequirementCategoryEnum = z2.enum([
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
  "OTHER"
]);
var RequirementImportanceEnum = z2.enum([
  "REQUIRED",
  "PREFERRED",
  "NICE_TO_HAVE",
  "UNKNOWN"
]);
var WorkArrangementEnum = z2.enum([
  "REMOTE",
  "HYBRID",
  "ONSITE",
  "UNKNOWN"
]);
var RequirementRelationshipEnum = z2.enum(["AND", "OR", "OPTIONAL"]);
var KeywordCategoryEnum = z2.enum([
  "TECHNICAL",
  "DOMAIN",
  "ROLE",
  "TOOL",
  "PLATFORM",
  "SOFT_SKILL",
  "CERTIFICATION",
  "EDUCATION",
  "INDUSTRY"
]);
var JobKeywordSchema = z2.object({
  keyword: z2.string().min(1, "Keyword must not be empty"),
  category: KeywordCategoryEnum.or(z2.string()).default("TECHNICAL"),
  importance: RequirementImportanceEnum.default("REQUIRED"),
  frequency: z2.number().int().min(1, "Frequency must be at least 1").default(1),
  evidence: z2.string().default(""),
  confidence: z2.number().min(0, "Confidence must be >= 0").max(1, "Confidence must be <= 1").default(1)
});
var SkillRequirementSchema = z2.object({
  name: z2.string().min(1, "Skill name is required"),
  normalizedName: z2.string().min(1, "Normalized skill name is required"),
  category: RequirementCategoryEnum.or(z2.string()).default("REQUIRED_SKILL"),
  importance: RequirementImportanceEnum.default("REQUIRED"),
  explicit: z2.boolean().default(true),
  evidence: z2.string().default(""),
  confidence: z2.number().min(0, "Confidence must be >= 0").max(1, "Confidence must be <= 1").default(1)
});
var ResponsibilitySchema = z2.object({
  text: z2.string().min(1, "Responsibility text is required"),
  importance: RequirementImportanceEnum.default("REQUIRED"),
  evidence: z2.string().default(""),
  confidence: z2.number().min(0, "Confidence must be >= 0").max(1, "Confidence must be <= 1").default(1)
});
var RequirementSchema = z2.object({
  text: z2.string().min(1, "Requirement text is required"),
  category: RequirementCategoryEnum.default("OTHER"),
  importance: RequirementImportanceEnum.default("REQUIRED"),
  explicit: z2.boolean().default(true),
  evidence: z2.string().default(""),
  confidence: z2.number().min(0, "Confidence must be >= 0").max(1, "Confidence must be <= 1").default(1),
  relationship: RequirementRelationshipEnum.optional().nullable(),
  relatedRequirements: z2.array(z2.string()).default([])
});
var ExperienceRequirementSchema = z2.object({
  yearsMin: z2.number().min(0).nullable().default(null),
  yearsMax: z2.number().min(0).nullable().default(null),
  domain: z2.string().nullable().default(null),
  management: z2.boolean().default(false),
  importance: RequirementImportanceEnum.default("REQUIRED"),
  explicit: z2.boolean().default(true),
  evidence: z2.string().default(""),
  confidence: z2.number().min(0, "Confidence must be >= 0").max(1, "Confidence must be <= 1").default(1)
});
var EducationRequirementSchema = z2.object({
  degree: z2.string().nullable().default(null),
  field: z2.string().nullable().default(null),
  minimum: z2.boolean().default(true),
  preferred: z2.boolean().default(false),
  importance: RequirementImportanceEnum.default("REQUIRED"),
  explicit: z2.boolean().default(true),
  evidence: z2.string().default(""),
  confidence: z2.number().min(0, "Confidence must be >= 0").max(1, "Confidence must be <= 1").default(1)
});
var CertificationRequirementSchema = z2.object({
  name: z2.string().min(1, "Certification name is required"),
  importance: RequirementImportanceEnum.default("REQUIRED"),
  explicit: z2.boolean().default(true),
  evidence: z2.string().default(""),
  confidence: z2.number().min(0, "Confidence must be >= 0").max(1, "Confidence must be <= 1").default(1)
});
var JobAnalysisSchema = z2.object({
  jobTitle: z2.string().nullable().default(null),
  company: z2.string().nullable().default(null),
  seniority: SeniorityEnum.default("UNKNOWN"),
  summary: z2.string().nullable().default(null),
  responsibilities: z2.array(ResponsibilitySchema).default([]),
  requirements: z2.array(RequirementSchema).default([]),
  skills: z2.array(SkillRequirementSchema).default([]),
  education: z2.array(EducationRequirementSchema).default([]),
  certifications: z2.array(CertificationRequirementSchema).default([]),
  experience: z2.array(ExperienceRequirementSchema).default([]),
  keywords: z2.array(JobKeywordSchema).default([]),
  workArrangement: WorkArrangementEnum.nullable().default(null),
  location: z2.string().nullable().default(null),
  industry: z2.string().nullable().default(null),
  workAuthorization: z2.string().nullable().default(null),
  // Convenience / backward compatibility fields
  roleSummary: z2.string().optional(),
  requiredSkills: z2.array(z2.string()).optional(),
  preferredSkills: z2.array(z2.string()).optional(),
  coreResponsibilities: z2.array(z2.string()).optional(),
  domainKeywords: z2.array(z2.string()).optional(),
  seniorityLevel: z2.string().optional(),
  educationRequirements: z2.string().optional(),
  experienceYearsMinimum: z2.number().optional()
});
var MATCH_SCORE_VERSION = "v1";
var DEFAULT_MATCH_SCORE_WEIGHTS = {
  requiredRequirements: 40,
  preferredSkills: 15,
  experience: 20,
  responsibilities: 10,
  education: 5,
  certifications: 5,
  keywords: 5,
  // Combined skills weight alias for backward compatibility (40 + 15 = 55)
  skills: 55
};
var MatchComponentSchema = z2.object({
  score: z2.number().min(0).max(100),
  weight: z2.number().min(0).max(100),
  weightedScore: z2.number().min(0).max(100),
  matchedCount: z2.number().int().min(0),
  totalCount: z2.number().int().min(0),
  details: z2.string().optional()
});
var MatchItemStateEnum = z2.enum([
  "MATCHED",
  "PARTIAL",
  "MISSING",
  "UNKNOWN"
]);
var MatchedSkillItemSchema = z2.object({
  skill: z2.string(),
  normalizedSkill: z2.string(),
  importance: RequirementImportanceEnum.default("REQUIRED"),
  matchType: MatchItemStateEnum,
  resumeEvidence: z2.array(z2.string()).default([]),
  jobEvidence: z2.string().optional(),
  confidence: z2.number().min(0).max(1).default(1),
  reason: z2.string().optional()
});
var MatchedRequirementItemSchema = z2.object({
  requirement: z2.string(),
  importance: RequirementImportanceEnum.default("REQUIRED"),
  matchType: MatchItemStateEnum,
  resumeEvidence: z2.array(z2.string()).default([]),
  jobEvidence: z2.string().optional(),
  confidence: z2.number().min(0).max(1).default(1),
  relationship: RequirementRelationshipEnum.default("OPTIONAL"),
  reason: z2.string().optional()
});
var MatchStrengthSchema = z2.object({
  title: z2.string(),
  detail: z2.string(),
  evidence: z2.array(z2.string()).default([]),
  category: z2.string().default("TECHNICAL")
});
var MatchGapSchema = z2.object({
  title: z2.string(),
  detail: z2.string(),
  importance: RequirementImportanceEnum.default("REQUIRED"),
  missingType: z2.enum([
    "SKILL",
    "EXPERIENCE",
    "EDUCATION",
    "CERTIFICATION",
    "KEYWORD",
    "RESPONSIBILITY"
  ]).default("SKILL"),
  critical: z2.boolean().default(false),
  remedyHint: z2.string().optional()
});
var MatchRecommendationSchema = z2.object({
  title: z2.string(),
  description: z2.string(),
  priority: z2.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  actionable: z2.boolean().default(true)
});
var MatchScoreLabelEnum = z2.enum([
  "Strong Match",
  "Good Match",
  "Moderate Match",
  "Weak Match",
  "Low Match"
]);
function getMatchScoreLabel(score) {
  if (score >= 90) return "Strong Match";
  if (score >= 75) return "Good Match";
  if (score >= 60) return "Moderate Match";
  if (score >= 40) return "Weak Match";
  return "Low Match";
}
var MatchAnalysisSchema = z2.object({
  scoreVersion: z2.string().default(MATCH_SCORE_VERSION),
  overallScore: z2.number().min(0).max(100).describe("Deterministic normalized compatibility score from 0 to 100"),
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
  matchedSkills: z2.array(MatchedSkillItemSchema).default([]),
  missingSkills: z2.array(MatchedSkillItemSchema).default([]),
  partialSkills: z2.array(MatchedSkillItemSchema).default([]),
  matchedRequirements: z2.array(MatchedRequirementItemSchema).default([]),
  missingRequirements: z2.array(MatchedRequirementItemSchema).default([]),
  // Actionable findings
  strengths: z2.array(MatchStrengthSchema).default([]),
  gaps: z2.array(MatchGapSchema).default([]),
  recommendations: z2.array(MatchRecommendationSchema).default([]),
  // Snapshot timestamps & stale detection
  resumeUpdatedAt: z2.string().nullable().optional(),
  jobUpdatedAt: z2.string().nullable().optional(),
  isStale: z2.boolean().default(false),
  // Backward compatibility fields
  hardSkillsMatchScore: z2.number().min(0).max(100).optional(),
  experienceMatchScore: z2.number().min(0).max(100).optional(),
  tailoringRecommendations: z2.array(z2.string()).default([])
});

// packages/shared/src/schemas/ai.schema.ts
import { z as z3 } from "zod";
var StrategySchema = z3.object({
  targetAngle: z3.string().describe("Primary positioning narrative for candidate"),
  keywordsToEmphasize: z3.array(z3.string()).default([]),
  sectionsToPrioritize: z3.array(z3.string()).default([]),
  suggestedFraming: z3.record(z3.string(), z3.string()).default({}).describe("Key-value map of section to framing strategy"),
  strategicRecommendations: z3.array(z3.string()).default([])
});
var BulletRewriteSchema = z3.object({
  originalBullet: z3.string(),
  rewrittenBullet: z3.string(),
  keywordsAdded: z3.array(z3.string()).default([]),
  metricOrImpactAdded: z3.string().optional(),
  evidenceIdRef: z3.string().describe("Reference to supporting evidence claim ID")
});
var GeneratedContentSchema = z3.object({
  tailoredSummary: z3.string(),
  bulletRewrites: z3.array(BulletRewriteSchema).default([]),
  suggestedSkillAdditions: z3.array(z3.string()).default([]),
  rationale: z3.string().describe("Explanation of modifications made based on strategy")
});
var ATSAnalysisSchema = z3.object({
  atsScore: z3.number().min(0).max(100),
  parseabilityScore: z3.number().min(0).max(100),
  keywordMatchPercentage: z3.number().min(0).max(100),
  matchedKeywords: z3.array(z3.string()).default([]),
  missingHighValueKeywords: z3.array(z3.string()).default([]),
  formattingFlags: z3.array(z3.string()).default([]).describe("Issues like tables, columns, unusual headers"),
  recommendations: z3.array(z3.string()).default([])
});
var QualityReviewSchema = z3.object({
  overallScore: z3.number().min(0).max(100),
  approved: z3.boolean().describe(
    "True if resume passes quality thresholds for tone, grammar, and ATS standards"
  ),
  clarityScore: z3.number().min(0).max(100),
  impactScore: z3.number().min(0).max(100),
  grammaticalFlags: z3.array(z3.string()).default([]),
  actionVerbStrength: z3.enum(["WEAK", "MODERATE", "STRONG"]).default("STRONG"),
  critiqueNotes: z3.string().describe("Holistic feedback for final polish")
});
var AIUsageRecordSchema = z3.object({
  agentName: z3.string(),
  model: z3.string(),
  inputTokens: z3.number().int().nonnegative(),
  outputTokens: z3.number().int().nonnegative(),
  totalTokens: z3.number().int().nonnegative(),
  estimatedCostUsd: z3.number().nonnegative(),
  timestamp: z3.string().datetime().default(() => (/* @__PURE__ */ new Date()).toISOString())
});

// packages/shared/src/schemas/evidence.schema.ts
import { z as z4 } from "zod";
var VerificationStatusSchema = z4.enum([
  VerificationStatus.SUPPORTED,
  VerificationStatus.UNSUPPORTED,
  VerificationStatus.CONTRADICTED,
  VerificationStatus.UNCERTAIN
]);
var EvidenceSourceSchema = z4.object({
  sourceType: z4.enum([
    "ORIGINAL_RESUME",
    "USER_PROMPT",
    "USER_LINKEDIN",
    "ATTACHMENT",
    "MANUAL_ENTRY"
  ]),
  sourceIdentifier: z4.string().describe("File name, section title, or prompt input identifier"),
  rawSnippet: z4.string().describe("Exact quote or excerpt extracted from the source material"),
  confidenceScore: z4.number().min(0).max(1).describe("Confidence score between 0.0 and 1.0")
});
var ClaimEvidenceSchema = z4.object({
  id: z4.string().uuid().or(z4.string()),
  claimText: z4.string().min(1).describe(
    "The atomic factual statement extracted from resume or bullet point"
  ),
  claimCategory: z4.enum([
    "EMPLOYER",
    "JOB_TITLE",
    "EMPLOYMENT_DATES",
    "METRIC_OR_KPI",
    "TOOL_OR_TECHNOLOGY",
    "RESPONSIBILITY",
    "ACHIEVEMENT",
    "EDUCATION",
    "CERTIFICATION",
    "SKILL"
  ]),
  targetSection: z4.string().describe(
    "The resume section where this claim appears, e.g., Experience: Acme Corp"
  ),
  status: VerificationStatusSchema,
  sources: z4.array(EvidenceSourceSchema).default([]),
  verificationNotes: z4.string().optional().describe("Reasoning provided by the Fact Guard agent"),
  suggestedCorrection: z4.string().optional().describe("Proposed alternative text if unsupported or contradicted")
});
var FactCheckResultSchema = z4.object({
  verified: z4.boolean().describe("True if all claims are SUPPORTED or acceptable"),
  claims: z4.array(ClaimEvidenceSchema),
  totalClaimsCount: z4.number(),
  supportedCount: z4.number(),
  unsupportedCount: z4.number(),
  contradictedCount: z4.number(),
  uncertainCount: z4.number(),
  summary: z4.string().describe("Executive summary of fact guard review")
});

// packages/shared/src/schemas/workflow-state.schema.ts
import { z as z5 } from "zod";
var RevisionHistoryItemSchema = z5.object({
  revisionNumber: z5.number(),
  agentName: z5.string(),
  timestamp: z5.string().datetime(),
  summaryOfChanges: z5.string()
});
var WorkflowErrorSchema = z5.object({
  agentName: z5.string(),
  code: z5.string(),
  message: z5.string(),
  timestamp: z5.string().datetime(),
  retryable: z5.boolean().default(false)
});
var ResumeWorkflowStateSchema = z5.object({
  workflowId: z5.string().uuid(),
  userId: z5.string().min(1),
  workflowType: z5.enum([
    WorkflowType.CREATE_RESUME,
    WorkflowType.JOB_TAILORING,
    WorkflowType.RESUME_REVIEW
  ]),
  status: z5.enum([
    WorkflowStatus.PENDING,
    WorkflowStatus.RUNNING,
    WorkflowStatus.COMPLETED,
    WorkflowStatus.FAILED,
    WorkflowStatus.CANCELLED
  ]),
  currentStep: z5.string().optional(),
  retryCount: z5.number().int().min(0).default(0),
  maxRetries: z5.number().int().min(0).default(3),
  // Identifiers
  resumeId: z5.string().optional(),
  resumeVersionId: z5.string().optional(),
  jobDescriptionId: z5.string().optional(),
  // Workflow Data Payloads
  rawResumeText: z5.string().optional(),
  originalResume: ResumeSchema.optional(),
  parsedResume: ResumeSchema.optional(),
  rawJobText: z5.string().optional(),
  jobAnalysis: JobAnalysisSchema.optional(),
  keywordAnalysis: z5.record(z5.string(), z5.any()).optional(),
  matchingAnalysis: MatchAnalysisSchema.optional(),
  strategy: StrategySchema.optional(),
  generatedContent: GeneratedContentSchema.optional(),
  factVerification: FactCheckResultSchema.optional(),
  atsAnalysis: ATSAnalysisSchema.optional(),
  qualityReview: QualityReviewSchema.optional(),
  // Result & Audit Trails
  finalResume: ResumeSchema.optional(),
  revisionHistory: z5.array(RevisionHistoryItemSchema).default([]),
  errors: z5.array(WorkflowErrorSchema).default([]),
  metadata: z5.record(z5.string(), z5.any()).default({}),
  // Timestamps & Metrics
  totalTokensUsed: z5.number().int().default(0),
  estimatedCostUsd: z5.number().default(0),
  startedAt: z5.string().datetime().default(() => (/* @__PURE__ */ new Date()).toISOString()),
  completedAt: z5.string().datetime().optional()
});

// packages/shared/src/schemas/api.schema.ts
import { z as z7 } from "zod";

// packages/shared/src/schemas/template.schema.ts
import { z as z6 } from "zod";
var TemplateIdSchema = z6.enum([
  "modern",
  "classic",
  "minimal",
  "executive",
  "modern-standard"
]);
var CANONICAL_TEMPLATE_IDS = [
  "modern",
  "classic",
  "minimal",
  "executive"
];
var FontFamilySchema = z6.enum([
  "Inter",
  "Arial",
  "Helvetica",
  "Georgia",
  "Times New Roman"
]);
var FontSizeSchema = z6.enum(["sm", "md", "lg"]);
var AccentColorSchema = z6.enum([
  "slate",
  "navy",
  "blue",
  "emerald",
  "burgundy",
  "charcoal"
]);
var SpacingSchema = z6.enum(["compact", "comfortable", "spacious"]);
var MarginsSchema = z6.enum(["compact", "normal", "relaxed"]);
var PageSizeSchema = z6.enum(["a4", "letter"]);
var TemplateConfigSchema = z6.object({
  templateId: TemplateIdSchema.default("modern"),
  fontFamily: FontFamilySchema.default("Inter"),
  fontSize: FontSizeSchema.default("md"),
  accentColor: AccentColorSchema.default("blue"),
  spacing: SpacingSchema.default("comfortable"),
  margins: MarginsSchema.default("normal"),
  pageSize: PageSizeSchema.default("a4")
});
var COLOR_PALETTES = {
  slate: {
    id: "slate",
    name: "Slate",
    hex: "#475569",
    textClass: "text-slate-600",
    bgClass: "bg-slate-600",
    borderClass: "border-slate-600"
  },
  navy: {
    id: "navy",
    name: "Navy",
    hex: "#1e3a8a",
    textClass: "text-blue-900",
    bgClass: "bg-blue-900",
    borderClass: "border-blue-900"
  },
  blue: {
    id: "blue",
    name: "Corporate Blue",
    hex: "#2563eb",
    textClass: "text-blue-600",
    bgClass: "bg-blue-600",
    borderClass: "border-blue-600"
  },
  emerald: {
    id: "emerald",
    name: "Emerald Green",
    hex: "#059669",
    textClass: "text-emerald-600",
    bgClass: "bg-emerald-600",
    borderClass: "border-emerald-600"
  },
  burgundy: {
    id: "burgundy",
    name: "Burgundy",
    hex: "#831843",
    textClass: "text-pink-900",
    bgClass: "bg-pink-900",
    borderClass: "border-pink-900"
  },
  charcoal: {
    id: "charcoal",
    name: "Charcoal",
    hex: "#374151",
    textClass: "text-gray-700",
    bgClass: "bg-gray-700",
    borderClass: "border-gray-700"
  }
};
function normalizeTemplateId(id) {
  if (!id || id === "modern-standard" || id === "modern") return "modern";
  if (id === "classic") return "classic";
  if (id === "minimal") return "minimal";
  if (id === "executive") return "executive";
  return "modern";
}
function getDefaultTemplateConfig(templateId) {
  const canonical = normalizeTemplateId(templateId);
  switch (canonical) {
    case "classic":
      return {
        templateId: "classic",
        fontFamily: "Georgia",
        fontSize: "md",
        accentColor: "slate",
        spacing: "comfortable",
        margins: "normal",
        pageSize: "letter"
      };
    case "minimal":
      return {
        templateId: "minimal",
        fontFamily: "Arial",
        fontSize: "sm",
        accentColor: "charcoal",
        spacing: "compact",
        margins: "compact",
        pageSize: "a4"
      };
    case "executive":
      return {
        templateId: "executive",
        fontFamily: "Times New Roman",
        fontSize: "md",
        accentColor: "navy",
        spacing: "comfortable",
        margins: "normal",
        pageSize: "letter"
      };
    case "modern":
    default:
      return {
        templateId: "modern",
        fontFamily: "Inter",
        fontSize: "md",
        accentColor: "blue",
        spacing: "comfortable",
        margins: "normal",
        pageSize: "a4"
      };
  }
}

// packages/shared/src/schemas/api.schema.ts
var ApiHealthResponseSchema = z7.object({
  success: z7.literal(true),
  service: z7.literal("resumeai-api"),
  status: z7.literal("healthy"),
  timestamp: z7.string().datetime().optional(),
  uptimeSeconds: z7.number().optional()
});
var ApiErrorPayloadSchema = z7.object({
  code: z7.string().default(ErrorCode.INTERNAL_SERVER_ERROR),
  message: z7.string(),
  details: z7.any().optional()
});
var ApiResponseSchema = (dataSchema) => z7.union([
  z7.object({
    success: z7.literal(true),
    data: dataSchema,
    message: z7.string().optional()
  }),
  z7.object({
    success: z7.literal(false),
    error: ApiErrorPayloadSchema
  })
]);
var RegisterRequestSchema = z7.object({
  email: z7.string().email("Valid email is required"),
  password: z7.string().min(8, "Password must be at least 8 characters"),
  name: z7.string().min(1, "Name is required")
});
var LoginRequestSchema = z7.object({
  email: z7.string().email("Valid email is required"),
  password: z7.string().min(1, "Password is required")
});
var CreateResumeRequestSchema = z7.object({
  title: z7.string().min(1, "Title is required").default("My Resume"),
  templateId: z7.string().default("modern-standard"),
  targetRole: z7.string().optional(),
  initialData: ResumeDataSchema.optional(),
  templateConfig: TemplateConfigSchema.optional()
});
var UpdateResumeRequestSchema = z7.object({
  title: z7.string().min(1).optional(),
  targetRole: z7.string().optional(),
  templateId: z7.string().optional(),
  templateConfig: TemplateConfigSchema.optional(),
  resumeData: ResumeDataSchema.optional(),
  changeSummary: z7.string().optional(),
  createVersion: z7.boolean().optional()
});
var UpdateResumeDesignRequestSchema = z7.object({
  templateId: TemplateIdSchema.optional(),
  templateConfig: TemplateConfigSchema.optional()
});
var DuplicateResumeRequestSchema = z7.object({
  title: z7.string().min(1).optional()
});
var CreateVersionRequestSchema = z7.object({
  changeSummary: z7.string().min(1, "Change summary is required").optional()
});
var CreateJobRequestSchema = z7.object({
  title: z7.string().optional(),
  company: z7.string().optional(),
  rawText: z7.string().min(50, "Job description text must be at least 50 characters").max(
    3e4,
    "Job description text exceeds maximum limit of 30,000 characters"
  ),
  url: z7.string().url().optional().or(z7.literal("")),
  resumeId: z7.string().uuid().optional(),
  autoAnalyze: z7.boolean().default(true)
});
var CreateMatchRequestSchema = z7.object({
  resumeId: z7.string().uuid("Invalid resume ID"),
  jobId: z7.string().uuid("Invalid job ID")
});
var TriggerWorkflowRequestSchema = z7.object({
  workflowType: z7.enum(["CREATE_RESUME", "JOB_TAILORING", "RESUME_REVIEW"]),
  resumeId: z7.string().optional(),
  jobId: z7.string().optional(),
  rawInput: z7.string().optional(),
  targetRole: z7.string().optional()
});
var UpdateProfileRequestSchema = z7.object({
  name: z7.string().min(1, "Name is required").optional()
}).strict();
var UserProfileResponseSchema = z7.object({
  id: z7.string(),
  email: z7.string(),
  name: z7.string(),
  role: z7.enum(["USER", "ADMIN"]),
  subscriptionTier: z7.enum(["FREE", "PRO", "ENTERPRISE"]),
  creditsBalance: z7.number(),
  image: z7.string().nullable(),
  emailVerified: z7.string().datetime().nullable(),
  createdAt: z7.string().datetime()
});

// packages/shared/src/schemas/import.schema.ts
import { z as z8 } from "zod";
var ImportStatusEnum = z8.enum([
  "PENDING",
  "EXTRACTING",
  "PARSING",
  "VALIDATING",
  "COMPLETED",
  "FAILED"
]);
var ConfidenceScoreSchema = z8.preprocess((val) => {
  if (typeof val === "string") {
    val = parseFloat(val);
  }
  if (typeof val === "number" && !isNaN(val)) {
    if (val > 1 && val <= 100) return val / 100;
    if (val < 0) return 0;
    if (val > 1) return 1;
    return val;
  }
  return 0.8;
}, z8.number().min(0).max(1).default(0.8));
var ParseConfidenceSchema = z8.preprocess((val) => {
  if (typeof val === "number") {
    const num = val > 1 && val <= 100 ? val / 100 : Math.min(Math.max(val, 0), 1);
    return {
      personalInfo: num,
      summary: num,
      experience: num,
      education: num,
      skills: num,
      projects: num,
      certifications: num,
      achievements: num,
      languages: num,
      links: num,
      overall: num
    };
  }
  if (val && typeof val === "object") {
    return val;
  }
  return {};
}, z8.object({
  personalInfo: ConfidenceScoreSchema,
  summary: ConfidenceScoreSchema,
  experience: ConfidenceScoreSchema,
  education: ConfidenceScoreSchema,
  skills: ConfidenceScoreSchema,
  projects: ConfidenceScoreSchema,
  certifications: ConfidenceScoreSchema,
  achievements: ConfidenceScoreSchema,
  languages: ConfidenceScoreSchema,
  links: ConfidenceScoreSchema,
  overall: ConfidenceScoreSchema
}).default({}));
var ResumeParseResultObjectSchema = z8.object({
  resumeData: ResumeDataSchema,
  confidence: ParseConfidenceSchema.default({}),
  warnings: z8.preprocess((v) => {
    if (Array.isArray(v)) return v.map(String);
    if (typeof v === "string") return [v];
    return [];
  }, z8.array(z8.string()).default([]))
});
var ResumeParseResultSchema = z8.preprocess((val) => {
  if (!val || typeof val !== "object") return { resumeData: {} };
  if (!val.resumeData && (val.personalInfo || val.experience || val.education || val.skills || val.summary)) {
    return {
      resumeData: val,
      confidence: val.confidence || {},
      warnings: Array.isArray(val.warnings) ? val.warnings : []
    };
  }
  return val;
}, ResumeParseResultObjectSchema);
var MAX_IMPORT_FILE_SIZE_BYTES = 10 * 1024 * 1024;
var ALLOWED_IMPORT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];
var ALLOWED_IMPORT_EXTENSIONS = [".pdf", ".docx"];
var ExtractedPageSchema = z8.object({
  pageNumber: z8.number().int().min(1),
  text: z8.string(),
  characterCount: z8.number().int().min(0),
  wordCount: z8.number().int().min(0),
  hasColumns: z8.boolean().optional()
});
var ExtractedDocumentSchema = z8.object({
  fileType: z8.enum(["pdf", "docx"]),
  pageCount: z8.number().int().min(1),
  actualPageCount: z8.number().int().min(1),
  pages: z8.array(ExtractedPageSchema),
  totalCharacters: z8.number().int().min(0),
  totalWords: z8.number().int().min(0),
  rawText: z8.string(),
  structuredText: z8.string(),
  warnings: z8.array(z8.string()).default([]),
  isScannedOrImageOnly: z8.boolean().default(false),
  metadata: z8.record(z8.any()).default({})
});
var ImportDetectedCountsSchema = z8.object({
  experience: z8.number().int().min(0).default(0),
  projects: z8.number().int().min(0).default(0),
  skills: z8.number().int().min(0).default(0),
  education: z8.number().int().min(0).default(0),
  certifications: z8.number().int().min(0).default(0),
  languages: z8.number().int().min(0).default(0),
  links: z8.number().int().min(0).default(0)
});
var ImportMetadataSchema = z8.object({
  importId: z8.string().uuid(),
  status: ImportStatusEnum,
  originalFilename: z8.string(),
  mimeType: z8.string(),
  fileSizeBytes: z8.number(),
  pageCount: z8.number().int().optional(),
  actualPageCount: z8.number().int().optional(),
  extractedWordCount: z8.number().int().optional(),
  extractedCharCount: z8.number().int().optional(),
  detectedCounts: ImportDetectedCountsSchema.optional(),
  confidence: ParseConfidenceSchema.optional(),
  warnings: z8.array(z8.string()).default([]),
  extractionWarnings: z8.array(z8.string()).default([]),
  parserWarnings: z8.array(z8.string()).default([]),
  processingTimeMs: z8.number().optional(),
  aiTokensUsed: z8.number().default(0)
});

// packages/shared/src/schemas/strategy.schema.ts
import { z as z9 } from "zod";
var RESUME_STRATEGY_VERSION = "v1";
var StrategyApprovalStatusEnum = z9.enum([
  "DRAFT",
  "REVIEWED",
  "APPROVED"
]);
var SectionStrategyActionEnum = z9.enum([
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
  "OMIT_IF_EMPTY"
]);
var SectionPriorityEnum = z9.enum(["HIGH", "MEDIUM", "LOW", "NONE"]);
var SectionActionItemSchema = z9.object({
  action: SectionStrategyActionEnum,
  itemId: z9.string().optional(),
  reason: z9.string().min(1),
  targetRequirementIds: z9.array(z9.string()).default([]),
  evidenceIds: z9.array(z9.string()).default([]),
  priority: z9.enum(["HIGH", "MEDIUM", "LOW"]).default("HIGH"),
  confidence: z9.number().min(0).max(1).default(1)
});
var ResumeSectionNameEnum = z9.enum([
  "personalInfo",
  "summary",
  "experience",
  "education",
  "projects",
  "skills",
  "certifications",
  "achievements",
  "languages",
  "links"
]);
var SectionStrategySchema = z9.object({
  section: ResumeSectionNameEnum,
  action: SectionStrategyActionEnum.optional(),
  actions: z9.array(SectionActionItemSchema).default([]),
  priority: z9.union([z9.number().int().min(1).max(5), SectionPriorityEnum]).default("HIGH"),
  reason: z9.string().min(1, "Reason is required"),
  evidence: z9.array(z9.string()).default([]),
  confidence: z9.number().min(0).max(1).default(1)
});
var SkillRecommendationSchema = z9.object({
  skill: z9.string().min(1),
  source: z9.enum(["resume", "job", "both"]).default("both"),
  reason: z9.string().min(1),
  evidence: z9.array(z9.string()).default([])
});
var MissingSkillRecommendationSchema = z9.object({
  skill: z9.string().min(1),
  reason: z9.string().min(1),
  action: z9.literal("DO_NOT_CLAIM").default("DO_NOT_CLAIM"),
  advisoryNote: z9.string().optional()
});
var SkillStrategySchema = z9.object({
  emphasize: z9.array(SkillRecommendationSchema).default([]),
  maintain: z9.array(SkillRecommendationSchema).default([]),
  deemphasize: z9.array(SkillRecommendationSchema).default([]),
  missing: z9.array(MissingSkillRecommendationSchema).default([])
});
var KeywordClassificationEnum = z9.enum([
  "SAFE_TO_SURFACE",
  "ALREADY_PRESENT",
  "RELATED_BUT_REQUIRES_EVIDENCE",
  "MISSING_DO_NOT_ADD",
  "LOW_VALUE"
]);
var KeywordStrategyItemSchema = z9.object({
  keyword: z9.string().min(1),
  classification: KeywordClassificationEnum,
  resumeEvidence: z9.array(z9.string()).default([]),
  jobEvidence: z9.array(z9.string()).default([]),
  reason: z9.string().optional()
});
var KeywordNaturallyIncludeItemSchema = z9.object({
  keyword: z9.string().min(1),
  requirementId: z9.string().optional().default(""),
  evidenceIds: z9.array(z9.string()).default([]),
  reason: z9.string().min(1)
});
var KeywordAlreadyCoveredItemSchema = z9.object({
  keyword: z9.string().min(1),
  evidenceIds: z9.array(z9.string()).default([])
});
var KeywordMissingUnsafeItemSchema = z9.object({
  keyword: z9.string().min(1),
  requirementId: z9.string().optional().default(""),
  reason: z9.string().min(1)
});
var KeywordStrategySchema = z9.object({
  keywords: z9.array(KeywordStrategyItemSchema).default([]),
  mustNaturallyInclude: z9.array(KeywordNaturallyIncludeItemSchema).default([]),
  alreadyCovered: z9.array(KeywordAlreadyCoveredItemSchema).default([]),
  missingAndUnsafe: z9.array(KeywordMissingUnsafeItemSchema).default([])
});
var ExperienceStrategyActionEnum = z9.enum([
  "EMPHASIZE_RELEVANT_RESPONSIBILITIES",
  "EMPHASIZE_RELEVANT_TECHNOLOGIES",
  "EMPHASIZE_RELEVANT_OUTCOMES",
  "MAINTAIN",
  "CONDENSE_LESS_RELEVANT_CONTENT"
]);
var ExperienceStrategyItemSchema = z9.object({
  experienceId: z9.string().min(1),
  company: z9.string().optional(),
  jobTitle: z9.string().optional(),
  priority: z9.number().int().min(1).max(5),
  actions: z9.array(ExperienceStrategyActionEnum).min(1),
  reason: z9.string().min(1),
  evidence: z9.array(z9.string()).default([])
});
var ExperienceStrategySchema = z9.object({
  items: z9.array(ExperienceStrategyItemSchema).default([])
});
var ProjectStrategyActionEnum = z9.enum([
  "EMPHASIZE",
  "MAINTAIN",
  "CONDENSE",
  "DEPRIORITIZE"
]);
var ProjectStrategyItemSchema = z9.object({
  projectId: z9.string().min(1),
  projectName: z9.string().optional(),
  priority: z9.number().int().min(1).max(5),
  action: ProjectStrategyActionEnum,
  reason: z9.string().min(1),
  evidence: z9.array(z9.string()).default([])
});
var ProjectStrategySchema = z9.object({
  items: z9.array(ProjectStrategyItemSchema).default([])
});
var GapClassificationEnum = z9.enum([
  "MISSING_REQUIRED",
  "MISSING_PREFERRED",
  "PARTIAL_MATCH",
  "EVIDENCE_WEAK",
  "UNKNOWN"
]);
var GapStrategyItemSchema = z9.object({
  requirement: z9.string().min(1),
  classification: GapClassificationEnum,
  recommendation: z9.string().default("DO_NOT_CLAIM"),
  reason: z9.string().min(1),
  advisoryTip: z9.string().optional()
});
var GapStrategySchema = z9.object({
  gaps: z9.array(GapStrategyItemSchema).default([])
});
var PreservationRuleEnum = z9.enum([
  "PRESERVE_EMPLOYMENT_DATES",
  "PRESERVE_EMPLOYER_NAMES",
  "PRESERVE_EDUCATION_CREDENTIALS",
  "PRESERVE_VERIFIED_CERTIFICATIONS",
  "PRESERVE_FACTUAL_METRICS",
  "PRESERVE_EXISTING_JOB_TITLES"
]);
var PreservationRuleItemSchema = z9.object({
  rule: PreservationRuleEnum,
  description: z9.string().min(1)
});
var DEFAULT_PRESERVATION_RULES = [
  {
    rule: "PRESERVE_EMPLOYMENT_DATES",
    description: "Preserve exact start and end dates for all employment positions."
  },
  {
    rule: "PRESERVE_EMPLOYER_NAMES",
    description: "Preserve genuine employer and company names without alteration."
  },
  {
    rule: "PRESERVE_EDUCATION_CREDENTIALS",
    description: "Preserve authentic educational institutions, degrees, and GPA values."
  },
  {
    rule: "PRESERVE_VERIFIED_CERTIFICATIONS",
    description: "Preserve issued certification credentials and issuing authorities."
  },
  {
    rule: "PRESERVE_FACTUAL_METRICS",
    description: "Preserve quantified metrics, percentages, and dollar values from original bullets."
  },
  {
    rule: "PRESERVE_EXISTING_JOB_TITLES",
    description: "Preserve candidate existing job titles without unwarranted inflation."
  }
];
var ProhibitedChangeEnum = z9.enum([
  "DO_NOT_INVENT_EMPLOYER",
  "DO_NOT_INVENT_JOB_TITLE",
  "DO_NOT_INVENT_DATES",
  "DO_NOT_INVENT_TECHNOLOGIES",
  "DO_NOT_INVENT_CERTIFICATIONS",
  "DO_NOT_INVENT_METRICS",
  "DO_NOT_UPGRADE_JOB_TITLE",
  "DO_NOT_CLAIM_UNSUPPORTED_SKILL",
  "DO_NOT_CLAIM_UNSUPPORTED_EXPERIENCE",
  "DO_NOT_CREATE_FAKE_ACHIEVEMENTS"
]);
var ProhibitedChangeItemSchema = z9.object({
  rule: ProhibitedChangeEnum,
  reason: z9.string().min(1)
});
var DEFAULT_PROHIBITED_CHANGES = [
  {
    rule: "DO_NOT_INVENT_EMPLOYER",
    reason: "Fabricating employment history violates verification integrity."
  },
  {
    rule: "DO_NOT_INVENT_JOB_TITLE",
    reason: "Job titles must reflect actual held roles."
  },
  {
    rule: "DO_NOT_INVENT_DATES",
    reason: "Tenure dates must match verifiable employment history."
  },
  {
    rule: "DO_NOT_INVENT_TECHNOLOGIES",
    reason: "Only technologies evidenced in candidate source material may be claimed."
  },
  {
    rule: "DO_NOT_INVENT_CERTIFICATIONS",
    reason: "Credentials must correspond to authentic earned certificates."
  },
  {
    rule: "DO_NOT_INVENT_METRICS",
    reason: "Performance metrics and percentages must not be manufactured."
  },
  {
    rule: "DO_NOT_UPGRADE_JOB_TITLE",
    reason: "Titles must not be inflated to meet senior role requirements."
  },
  {
    rule: "DO_NOT_CLAIM_UNSUPPORTED_SKILL",
    reason: "Skills not present in source resume must remain unstated or flagged as absent."
  },
  {
    rule: "DO_NOT_CLAIM_UNSUPPORTED_EXPERIENCE",
    reason: "Responsibilities not evidenced in history must not be claimed."
  },
  {
    rule: "DO_NOT_CREATE_FAKE_ACHIEVEMENTS",
    reason: "All awards and achievements must originate from genuine candidate background."
  }
];
var StrategyEvidenceSchema = z9.object({
  strategyItemId: z9.string().min(1),
  sourceType: z9.enum(["RESUME", "JOB", "MATCH"]),
  sourceId: z9.string().min(1),
  excerpt: z9.string().optional(),
  relationship: z9.enum(["SUPPORTS", "CONTRADICTS", "REQUIRES_VERIFICATION"]),
  confidence: z9.number().min(0).max(1).default(1)
});
var OverviewStrategySchema = z9.object({
  objective: z9.string().default("Tailor resume for target role"),
  overallApproach: z9.string().min(5),
  prioritySummary: z9.string().default("Align skills and experience with key job requirements")
});
var RequirementStatusEnum = z9.enum([
  "MATCHED",
  "PARTIAL",
  "MISSING",
  "NOT_APPLICABLE",
  "UNKNOWN"
]);
var RequirementStrategyActionEnum = z9.enum([
  "EMPHASIZE_EXISTING_EVIDENCE",
  "CLARIFY_EXISTING_EVIDENCE",
  "REPOSITION_EXISTING_EVIDENCE",
  "NO_ACTION",
  "DO_NOT_INVENT",
  "REVIEW_MANUALLY"
]);
var RequirementStrategyItemSchema = z9.object({
  requirementId: z9.string().min(1),
  status: RequirementStatusEnum,
  strategy: RequirementStrategyActionEnum,
  evidenceIds: z9.array(z9.string()).default([]),
  reason: z9.string().min(1),
  priority: z9.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM")
});
var RiskFlagTypeEnum = z9.enum([
  "MISSING_EVIDENCE",
  "AMBIGUOUS_EVIDENCE",
  "POTENTIAL_OVERCLAIM",
  "KEYWORD_STUFFING_RISK",
  "CONTRADICTION",
  "INSUFFICIENT_CONTEXT"
]);
var RiskFlagSchema = z9.object({
  type: RiskFlagTypeEnum,
  description: z9.string().min(1),
  evidenceIds: z9.array(z9.string()).default([]),
  severity: z9.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM")
});
var ProtectedFactSchema = z9.object({
  field: z9.string().min(1),
  value: z9.string().min(1),
  evidenceIds: z9.array(z9.string()).default([]),
  reason: z9.string().min(1)
});
var ResumeStrategySchema = z9.object({
  id: z9.string().optional(),
  resumeId: z9.string().uuid(),
  jobId: z9.string().uuid(),
  matchId: z9.string().uuid().optional().nullable(),
  strategyVersion: z9.string().default(RESUME_STRATEGY_VERSION),
  status: StrategyApprovalStatusEnum.default("DRAFT"),
  overview: OverviewStrategySchema.optional(),
  overallApproach: z9.string().min(10, "Overall approach must be at least 10 characters"),
  sectionStrategies: z9.array(SectionStrategySchema).default([]),
  skillStrategy: SkillStrategySchema,
  keywordStrategy: KeywordStrategySchema,
  experienceStrategy: ExperienceStrategySchema,
  projectStrategy: ProjectStrategySchema,
  gapStrategy: GapStrategySchema,
  requirementStrategy: z9.array(RequirementStrategyItemSchema).default([]),
  riskFlags: z9.array(RiskFlagSchema).default([]),
  protectedFacts: z9.array(ProtectedFactSchema).default([]),
  preservationRules: z9.array(PreservationRuleItemSchema).default(DEFAULT_PRESERVATION_RULES),
  prohibitedChanges: z9.array(ProhibitedChangeItemSchema).default(DEFAULT_PROHIBITED_CHANGES),
  evidence: z9.array(StrategyEvidenceSchema).default([]),
  confidence: z9.number().min(0).max(1).default(0.95),
  // Snapshot timestamps & stale tracking
  resumeUpdatedAt: z9.string().nullable().optional(),
  jobUpdatedAt: z9.string().nullable().optional(),
  matchUpdatedAt: z9.string().nullable().optional(),
  isStale: z9.boolean().default(false),
  generatedAt: z9.string().optional(),
  createdAt: z9.string().optional(),
  updatedAt: z9.string().optional()
});
var CreateStrategyRequestSchema = z9.object({
  resumeId: z9.string().uuid("Invalid resumeId format"),
  jobId: z9.string().uuid("Invalid jobId format"),
  matchId: z9.string().uuid("Invalid matchId format").optional()
});
var UpdateStrategyStatusRequestSchema = z9.object({
  status: StrategyApprovalStatusEnum
});

// packages/shared/src/schemas/content-writer.schema.ts
import { z as z10 } from "zod";
var ContentProposalStatusEnum = {
  DRAFT: "DRAFT",
  PARTIALLY_ACCEPTED: "PARTIALLY_ACCEPTED",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  STALE: "STALE",
  APPLIED: "APPLIED"
};
var ContentProposalStatusSchema = z10.enum([
  "DRAFT",
  "PARTIALLY_ACCEPTED",
  "ACCEPTED",
  "REJECTED",
  "STALE",
  "APPLIED"
]);
var ChangeTypeSchema = z10.enum([
  "REWRITE",
  "CLARIFY",
  "KEYWORD_ALIGNMENT",
  "CONDENSE",
  "EXPAND",
  "REORDER"
]);
var ChangeSectionSchema = z10.enum([
  "summary",
  "experience",
  "projects",
  "skills",
  "education",
  "certifications",
  "achievements",
  "languages",
  "links"
]);
var ChangeRiskSchema = z10.enum(["LOW", "MEDIUM", "HIGH"]);
var ChangeStatusSchema = z10.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "BLOCKED"
]);
var ResumeContentChangeSchema = z10.object({
  id: z10.string().min(1).describe("Unique identifier for this proposed change"),
  section: ChangeSectionSchema.describe("Target resume section"),
  itemId: z10.string().optional().describe(
    "ID of the parent entity, e.g. experience entry ID or project ID"
  ),
  field: z10.string().min(1).describe("Target field or bullet path, e.g. summary, bullets[0], title"),
  originalValue: z10.string().describe("Original text from the resume before rewrite"),
  proposedValue: z10.string().min(1).describe("AI-rewritten or refined proposed text"),
  changeType: ChangeTypeSchema.describe("Classification of the change applied"),
  targetRequirementIds: z10.array(z10.string()).default([]).describe("Associated job requirement or keyword IDs targeted"),
  evidenceIds: z10.array(z10.string()).min(1, "Every change must trace back to at least one evidence ID").describe("IDs of candidate resume evidence validating this statement"),
  rationale: z10.string().min(1).describe("Explanation of why this rewrite strengthens alignment"),
  risk: ChangeRiskSchema.default("LOW").describe("Risk classification"),
  status: ChangeStatusSchema.default("PENDING").describe(
    "User review & Fact Guard approval status"
  ),
  factCheckStatus: VerificationStatusSchema.optional().default("SUPPORTED"),
  factCheckReasoning: z10.string().optional().describe("Fact Guard validation assessment"),
  blockedReason: z10.string().optional().describe("Specific reason if change was blocked by Fact Guard"),
  extractedClaims: z10.array(z10.string()).optional().describe("Individual factual claims extracted from proposed value")
});
var ContentProposalSummaryStatsSchema = z10.object({
  totalProposed: z10.number().int().min(0),
  verifiedCount: z10.number().int().min(0),
  blockedCount: z10.number().int().min(0),
  uncertainCount: z10.number().int().min(0)
});
var ContentProposalDataSchema = z10.object({
  changes: z10.array(ResumeContentChangeSchema),
  summaryStats: ContentProposalSummaryStatsSchema,
  generalNotes: z10.string().optional(),
  targetJobTitle: z10.string().optional(),
  targetCompany: z10.string().optional()
});
var GenerateContentProposalInputSchema = z10.object({
  resumeId: z10.string().uuid("Invalid resume UUID"),
  jobId: z10.string().uuid("Invalid job UUID"),
  matchId: z10.string().uuid("Invalid match UUID").optional(),
  strategyId: z10.string().uuid("Invalid strategy UUID").optional()
});
var ApplyContentProposalInputSchema = z10.object({
  selectedChangeIds: z10.array(z10.string()).optional().describe("Optional subset of approved change IDs to apply")
});
var UpdateChangeStatusInputSchema = z10.object({
  status: z10.enum(["APPROVED", "REJECTED"])
});
var RegenerateSectionInputSchema = z10.object({
  resumeId: z10.string().uuid("Invalid resume UUID"),
  section: ChangeSectionSchema,
  itemId: z10.string().optional(),
  field: z10.string().min(1, "Field path is required"),
  targetJobId: z10.string().uuid("Invalid job UUID").optional(),
  instruction: z10.string().max(500).optional()
});
var ATSCheckItemSchema = z10.object({
  name: z10.string(),
  passed: z10.boolean(),
  feedback: z10.string().optional()
});
var ATSCategoryScoresSchema = z10.object({
  formatting: z10.number().min(0).max(15),
  readability: z10.number().min(0).max(15),
  keyword: z10.number().min(0).max(20),
  structure: z10.number().min(0).max(15),
  evidence: z10.number().min(0).max(25)
});
var ATSValidationResultSchema = z10.object({
  isAtsFriendly: z10.boolean(),
  score: z10.number().min(0).max(100),
  checks: z10.array(ATSCheckItemSchema),
  summary: z10.string(),
  categoryScores: ATSCategoryScoresSchema.optional()
});
var FactualClaimCategorySchema = z10.preprocess((val) => {
  if (typeof val !== "string") return "TECHNOLOGY";
  const upper = val.toUpperCase().trim().replace(/[-\s]/g, "_");
  if (upper === "METRIC") return "METRIC_OR_KPI";
  if (upper === "ROLE") return "JOB_TITLE";
  if (upper === "DOMAIN") return "RESPONSIBILITY";
  if (upper === "COMPANY" || upper === "ORGANIZATION") return "EMPLOYER";
  if (upper === "SKILL" || upper === "LANGUAGE" || upper === "LIBRARY" || upper === "CLOUD_PLATFORM" || upper === "CLOUD" || upper === "INFRASTRUCTURE" || upper === "DEVOPS") {
    return "TECHNOLOGY";
  }
  if (upper === "PROJECT") return "ACHIEVEMENT";
  return upper;
}, z10.string().default("TECHNOLOGY"));
var FactualClaimSchema = z10.object({
  claim: z10.string().min(1, "Claim text must not be empty"),
  category: FactualClaimCategorySchema.default("TECHNOLOGY"),
  evidenceIds: z10.array(z10.string()).default([]),
  factCheckStatus: VerificationStatusSchema.default("SUPPORTED"),
  reason: z10.string().optional()
});
var SectionRegenerationOutputSchema = z10.object({
  proposedValue: z10.string().min(1, "Proposed value must not be empty"),
  rationale: z10.string().min(1, "Rationale is required"),
  evidenceIds: z10.array(z10.string()).default([]),
  changeType: ChangeTypeSchema.default("REWRITE"),
  claims: z10.array(FactualClaimSchema).optional().default([])
});
var SectionRegenerationResponseSchema = z10.object({
  proposalId: z10.string(),
  changeId: z10.string(),
  originalValue: z10.string(),
  proposedValue: z10.string(),
  rationale: z10.string(),
  evidenceIds: z10.array(z10.string()),
  factCheckStatus: VerificationStatusSchema,
  status: ChangeStatusSchema,
  blockedReason: z10.string().optional(),
  atsChecks: ATSValidationResultSchema,
  claims: z10.array(FactualClaimSchema).default([]),
  factGuardScore: z10.number().min(0).max(100).default(100),
  supportedClaimsCount: z10.number().int().min(0).default(0),
  unsupportedClaimsCount: z10.number().int().min(0).default(0)
});

// packages/shared/src/utils/redirect.ts
function getSafeRedirect(url) {
  if (!url || typeof url !== "string") return "/dashboard";
  const trimmed = url.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\") || trimmed.includes(":") || trimmed.startsWith("/login") || trimmed.startsWith("/register")) {
    return "/dashboard";
  }
  return trimmed;
}
export {
  AIUsageRecordSchema,
  ALLOWED_IMPORT_EXTENSIONS,
  ALLOWED_IMPORT_MIME_TYPES,
  ATSAnalysisSchema,
  ATSCategoryScoresSchema,
  ATSCheckItemSchema,
  ATSValidationResultSchema,
  AccentColorSchema,
  AchievementSchema,
  AgentName,
  ApiErrorPayloadSchema,
  ApiHealthResponseSchema,
  ApiResponseSchema,
  ApplyContentProposalInputSchema,
  BulletRewriteSchema,
  CANONICAL_TEMPLATE_IDS,
  COLOR_PALETTES,
  CertificationRequirementSchema,
  CertificationSchema,
  ChangeRiskSchema,
  ChangeSectionSchema,
  ChangeStatusSchema,
  ChangeTypeSchema,
  ClaimEvidenceSchema,
  ContactInfoSchema,
  ContentProposalDataSchema,
  ContentProposalStatusEnum,
  ContentProposalStatusSchema,
  ContentProposalSummaryStatsSchema,
  CreateJobRequestSchema,
  CreateMatchRequestSchema,
  CreateResumeRequestSchema,
  CreateStrategyRequestSchema,
  CreateVersionRequestSchema,
  CustomLinkSchema,
  DEFAULT_MATCH_SCORE_WEIGHTS,
  DEFAULT_PRESERVATION_RULES,
  DEFAULT_PROHIBITED_CHANGES,
  DEFAULT_SECTION_ORDER,
  DuplicateResumeRequestSchema,
  EducationRequirementSchema,
  EducationSchema,
  ErrorCode,
  EvidenceSourceSchema,
  ExperienceRequirementSchema,
  ExperienceStrategyActionEnum,
  ExperienceStrategyItemSchema,
  ExperienceStrategySchema,
  ExtractedDocumentSchema,
  ExtractedPageSchema,
  FactCheckResultSchema,
  FactualClaimCategorySchema,
  FactualClaimSchema,
  FontFamilySchema,
  FontSizeSchema,
  GapClassificationEnum,
  GapStrategyItemSchema,
  GapStrategySchema,
  GenerateContentProposalInputSchema,
  GeneratedContentSchema,
  ImportDetectedCountsSchema,
  ImportMetadataSchema,
  ImportStatusEnum,
  JobAnalysisSchema,
  JobKeywordSchema,
  KeywordAlreadyCoveredItemSchema,
  KeywordCategoryEnum,
  KeywordClassificationEnum,
  KeywordMissingUnsafeItemSchema,
  KeywordNaturallyIncludeItemSchema,
  KeywordStrategyItemSchema,
  KeywordStrategySchema,
  LanguageProficiencyEnum,
  LanguageSchema,
  LoginRequestSchema,
  MATCH_SCORE_VERSION,
  MAX_IMPORT_FILE_SIZE_BYTES,
  MAX_JOB_DESCRIPTION_CHARS,
  MIN_JOB_DESCRIPTION_CHARS,
  MarginsSchema,
  MatchAnalysisSchema,
  MatchComponentSchema,
  MatchGapSchema,
  MatchItemStateEnum,
  MatchRecommendationSchema,
  MatchScoreLabelEnum,
  MatchStrengthSchema,
  MatchedRequirementItemSchema,
  MatchedSkillItemSchema,
  MissingSkillRecommendationSchema,
  OverviewStrategySchema,
  PageSizeSchema,
  ParseConfidenceSchema,
  PersonalInfoSchema,
  PreservationRuleEnum,
  PreservationRuleItemSchema,
  ProhibitedChangeEnum,
  ProhibitedChangeItemSchema,
  ProjectSchema,
  ProjectStrategyActionEnum,
  ProjectStrategyItemSchema,
  ProjectStrategySchema,
  ProtectedFactSchema,
  QualityReviewSchema,
  RESUME_STRATEGY_VERSION,
  RegenerateSectionInputSchema,
  RegisterRequestSchema,
  RequirementCategoryEnum,
  RequirementImportanceEnum,
  RequirementRelationshipEnum,
  RequirementSchema,
  RequirementStatusEnum,
  RequirementStrategyActionEnum,
  RequirementStrategyItemSchema,
  ResponsibilitySchema,
  ResumeContentChangeSchema,
  ResumeDataSchema,
  ResumeParseResultSchema,
  ResumeSchema,
  ResumeSectionNameEnum,
  ResumeStrategySchema,
  ResumeWorkflowStateSchema,
  RevisionHistoryItemSchema,
  RiskFlagSchema,
  RiskFlagTypeEnum,
  SafeUrlSchema,
  SectionActionItemSchema,
  SectionPriorityEnum,
  SectionRegenerationOutputSchema,
  SectionRegenerationResponseSchema,
  SectionStrategyActionEnum,
  SectionStrategySchema,
  SectionVisibilitySchema,
  SeniorityEnum,
  SkillCategorySchema,
  SkillRecommendationSchema,
  SkillRequirementSchema,
  SkillStrategySchema,
  SpacingSchema,
  StrategyApprovalStatusEnum,
  StrategyEvidenceSchema,
  StrategySchema,
  SubscriptionTier,
  TemplateConfigSchema,
  TemplateIdSchema,
  TriggerWorkflowRequestSchema,
  UpdateChangeStatusInputSchema,
  UpdateProfileRequestSchema,
  UpdateResumeDesignRequestSchema,
  UpdateResumeRequestSchema,
  UpdateStrategyStatusRequestSchema,
  UserProfileResponseSchema,
  VerificationStatus,
  VerificationStatusSchema,
  WorkArrangementEnum,
  WorkExperienceSchema,
  WorkflowErrorSchema,
  WorkflowStatus,
  WorkflowType,
  createDefaultResumeData,
  getDefaultTemplateConfig,
  getMatchScoreLabel,
  getSafeRedirect,
  normalizeTemplateId
};
