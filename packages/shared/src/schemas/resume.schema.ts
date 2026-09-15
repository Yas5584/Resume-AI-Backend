import { z } from "zod";

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// Helper schema to strictly validate URLs, handles, and reject dangerous protocols like javascript: or data:
export const SafeUrlSchema = z.preprocess((val) => {
  if (val === null || val === undefined) return "";
  if (typeof val !== "string") return String(val);
  const trimmed = val.trim();
  if (
    !trimmed ||
    trimmed.toLowerCase() === "n/a" ||
    trimmed.toLowerCase() === "none"
  ) {
    return "";
  }

  // Reject dangerous protocols
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:")
  ) {
    return "";
  }

  // If starts with http:// or https://, return as-is
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  // Prepend https:// for standard domains or domain-like strings
  if (trimmed.startsWith("github.com/") || trimmed.startsWith("linkedin.com/")) {
    return `https://${trimmed}`;
  }
  if (trimmed.includes(".") && !trimmed.includes(" ") && !trimmed.includes("@")) {
    return `https://${trimmed}`;
  }
  return trimmed;
}, z.string().default(""));

// 1. Personal Information Schema
export const PersonalInfoSchema = z.object({
  fullName: z.preprocess(
    (v) => (v === null || v === undefined ? "" : String(v)),
    z.string().default(""),
  ),
  headline: z.preprocess(
    (v) => (v === null || v === undefined ? "" : String(v)),
    z.string().optional().default(""),
  ),
  email: z.preprocess(
    (v) => (v === null || v === undefined ? "" : String(v).trim()),
    z.string().optional().default(""),
  ),
  phone: z.preprocess(
    (v) => (v === null || v === undefined ? "" : String(v)),
    z.string().optional().default(""),
  ),
  location: z.preprocess(
    (v) => (v === null || v === undefined ? "" : String(v)),
    z.string().optional().default(""),
  ),
  website: SafeUrlSchema,
  linkedin: SafeUrlSchema,
  github: SafeUrlSchema,
  linkedinUrl: SafeUrlSchema,
  githubUrl: SafeUrlSchema,
  portfolioUrl: SafeUrlSchema,
});

export type PersonalInfo = z.infer<typeof PersonalInfoSchema>;
export const ContactInfoSchema = PersonalInfoSchema;
export type ContactInfo = PersonalInfo;

// Helper for string or array of strings
const StringArraySchema = z.preprocess((val) => {
  if (val === null || val === undefined) return [];
  if (typeof val === "string") return val.split("\n").map((s) => s.trim()).filter(Boolean);
  if (Array.isArray(val)) return val.map((item) => (typeof item === "string" ? item : JSON.stringify(item)));
  return [];
}, z.array(z.string()).default([]));

// Helper for array normalization
const ensureArray = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.preprocess((val) => {
    if (val === null || val === undefined) return [];
    if (Array.isArray(val)) return val;
    return [val];
  }, z.array(itemSchema).default([]));

// 2. Work Experience Schema
export const WorkExperienceSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    return {
      jobTitle: val.slice(0, 100),
      company: "Company",
      description: val,
      bullets: [val],
    };
  }
  if (val && typeof val === "object") {
    const obj = { ...val } as any;
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
  jobTitle: z.preprocess((v) => (v === null || v === undefined ? "Role" : String(v)), z.string().default("Role")),
  position: z.preprocess((v) => (v === null || v === undefined ? "" : String(v)), z.string().optional().default("")),
  company: z.preprocess((v) => (v === null || v === undefined ? "Company" : String(v)), z.string().default("Company")),
  location: z.preprocess((v) => (v === null || v === undefined ? "" : String(v)), z.string().optional().default("")),
  employmentType: z.preprocess((v) => (v === null || v === undefined ? "Full-time" : String(v)), z.string().optional().default("Full-time")),
  startDate: z.preprocess((v) => (v === null || v === undefined ? "" : String(v)), z.string().default("")),
  endDate: z.preprocess((v) => (v === null || v === undefined ? "" : String(v)), z.string().optional().default("")),
  current: z.preprocess((v) => Boolean(v), z.boolean().default(false)),
  description: z.preprocess((v) => (v === null || v === undefined ? "" : String(v)), z.string().optional().default("")),
  bullets: StringArraySchema,
  technologiesUsed: StringArraySchema,
}));

export type WorkExperience = z.infer<typeof WorkExperienceSchema>;

// 3. Education Schema
export const EducationSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    return {
      institution: val,
      degree: "Degree",
      description: val,
    };
  }
  if (val && typeof val === "object") {
    const obj = { ...val } as any;
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
  institution: z.preprocess((v) => (v === null || v === undefined ? "Institution" : String(v)), z.string().default("Institution")),
  degree: z.preprocess((v) => (v === null || v === undefined ? "Degree" : String(v)), z.string().default("Degree")),
  fieldOfStudy: z.preprocess((v) => (v === null || v === undefined ? "" : String(v)), z.string().optional().default("")),
  location: z.preprocess((v) => (v === null || v === undefined ? "" : String(v)), z.string().optional().default("")),
  startDate: z.preprocess((v) => (v === null || v === undefined ? "" : String(v)), z.string().optional().default("")),
  endDate: z.preprocess((v) => (v === null || v === undefined ? "" : String(v)), z.string().optional().default("")),
  current: z.preprocess((v) => Boolean(v), z.boolean().default(false)),
  gpa: z.preprocess((v) => (v === null || v === undefined ? "" : String(v)), z.string().optional().default("")),
  description: z.preprocess((v) => (v === null || v === undefined ? "" : String(v)), z.string().optional().default("")),
  honors: StringArraySchema,
}));

export type Education = z.infer<typeof EducationSchema>;

// 4. Projects Schema
export const ProjectSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    return {
      name: val.slice(0, 100),
      description: val,
      bullets: [val],
    };
  }
  if (val && typeof val === "object") {
    const obj = { ...val } as any;
    if (!obj.name && (obj.title || obj.projectName)) {
      obj.name = obj.title || obj.projectName;
    }
    return obj;
  }
  return val;
}, z.object({
  id: z.string().default(generateId),
  name: z.preprocess((v) => (v === null || v === undefined ? "Project" : String(v)), z.string().default("Project")),
  description: z.preprocess((v) => (v === null || v === undefined ? "" : String(v)), z.string().default("")),
  role: z.preprocess((v) => (v === null || v === undefined ? "" : String(v)), z.string().optional().default("")),
  technologies: StringArraySchema,
  startDate: z.preprocess((v) => (v === null || v === undefined ? "" : String(v)), z.string().optional().default("")),
  endDate: z.preprocess((v) => (v === null || v === undefined ? "" : String(v)), z.string().optional().default("")),
  url: SafeUrlSchema,
  repoUrl: SafeUrlSchema,
  bullets: StringArraySchema,
  highlights: StringArraySchema,
}));

export type Project = z.infer<typeof ProjectSchema>;

// 5. Skills Schema
export const SkillCategorySchema = z.preprocess((val) => {
  if (typeof val === "string") {
    return {
      category: "Skills",
      skills: [val],
    };
  }
  if (val && typeof val === "object") {
    const obj = { ...val } as any;
    if (!obj.category && (obj.name || obj.group || obj.title)) {
      obj.category = obj.name || obj.group || obj.title;
    }
    return obj;
  }
  return val;
}, z.object({
  id: z.string().default(generateId),
  category: z.preprocess((v) => (v === null || v === undefined ? "Skills" : String(v)), z.string().default("Skills")),
  skills: StringArraySchema,
}));

export type SkillCategory = z.infer<typeof SkillCategorySchema>;

const SkillsArraySchema = z.preprocess((val) => {
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
      skills: Array.isArray(sks) ? sks : [String(sks)],
    }));
  }
  return [];
}, z.array(SkillCategorySchema).default([]));

// 6. Certifications Schema
export const CertificationSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    return {
      name: val,
      issuer: "Issuer",
    };
  }
  if (val && typeof val === "object") {
    const obj = { ...val } as any;
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
  name: z.preprocess((v) => (v === null || v === undefined ? "Certification" : String(v)), z.string().default("Certification")),
  issuer: z.preprocess((v) => (v === null || v === undefined ? "Issuer" : String(v)), z.string().default("Issuer")),
  issueDate: z.preprocess((v) => (v === null || v === undefined ? "" : String(v)), z.string().optional().default("")),
  expirationDate: z.preprocess((v) => (v === null || v === undefined ? "" : String(v)), z.string().optional().default("")),
  credentialId: z.preprocess((v) => (v === null || v === undefined ? "" : String(v)), z.string().optional().default("")),
  credentialUrl: SafeUrlSchema,
}));

export type Certification = z.infer<typeof CertificationSchema>;

// 7. Achievements Schema
export const AchievementSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    return {
      title: val,
      description: "",
    };
  }
  if (val && typeof val === "object") {
    const obj = { ...val } as any;
    if (!obj.title && (obj.name || obj.award)) {
      obj.title = obj.name || obj.award;
    }
    return obj;
  }
  return val;
}, z.object({
  id: z.string().default(generateId),
  title: z.preprocess((v) => (v === null || v === undefined ? "Achievement" : String(v)), z.string().default("Achievement")),
  description: z.preprocess((v) => (v === null || v === undefined ? "" : String(v)), z.string().optional().default("")),
  date: z.preprocess((v) => (v === null || v === undefined ? "" : String(v)), z.string().optional().default("")),
}));

export type Achievement = z.infer<typeof AchievementSchema>;

// 8. Languages Schema
export const LanguageProficiencyEnum = z.enum([
  "Basic",
  "Conversational",
  "Professional",
  "Fluent",
  "Native",
]);

export type LanguageProficiency = z.infer<typeof LanguageProficiencyEnum>;

export const LanguageSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    return {
      language: val,
      proficiency: "Conversational",
    };
  }
  if (val && typeof val === "object") {
    const obj = { ...val } as any;
    if (!obj.language && (obj.name || obj.lang)) {
      obj.language = obj.name || obj.lang;
    }
    return obj;
  }
  return val;
}, z.object({
  id: z.string().default(generateId),
  language: z.preprocess((v) => (v === null || v === undefined ? "" : String(v)), z.string().default("")),
  proficiency: z.preprocess((val) => {
    if (typeof val !== "string") return "Conversational";
    const normalized = val.trim().toLowerCase();
    if (normalized.includes("native") || normalized.includes("mother")) return "Native";
    if (normalized.includes("fluent")) return "Fluent";
    if (normalized.includes("prof") || normalized.includes("advance")) return "Professional";
    if (normalized.includes("inter") || normalized.includes("conversa")) return "Conversational";
    if (normalized.includes("basic") || normalized.includes("element") || normalized.includes("beginner")) return "Basic";
    return "Conversational";
  }, LanguageProficiencyEnum.default("Conversational")),
}));

export type Language = z.infer<typeof LanguageSchema>;

// 9. Links Schema
export const CustomLinkSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    return {
      label: val,
      url: val,
    };
  }
  if (val && typeof val === "object") {
    const obj = { ...val } as any;
    if (!obj.label && (obj.name || obj.title || obj.platform)) {
      obj.label = obj.name || obj.title || obj.platform;
    }
    return obj;
  }
  return val;
}, z.object({
  id: z.string().default(generateId),
  label: z.preprocess((v) => (v === null || v === undefined ? "Link" : String(v)), z.string().default("Link")),
  url: SafeUrlSchema,
}));

export type CustomLink = z.infer<typeof CustomLinkSchema>;

// 10. Section Visibility Schema
export const SectionVisibilitySchema = z.object({
  showSummary: z.boolean().default(true),
  showExperience: z.boolean().default(true),
  showEducation: z.boolean().default(true),
  showProjects: z.boolean().default(true),
  showSkills: z.boolean().default(true),
  showCertifications: z.boolean().default(true),
  showAchievements: z.boolean().default(true),
  showLanguages: z.boolean().default(true),
  showLinks: z.boolean().default(true),
});

export type SectionVisibility = z.infer<typeof SectionVisibilitySchema>;

export const DEFAULT_SECTION_ORDER = [
  "summary",
  "experience",
  "education",
  "projects",
  "skills",
  "certifications",
  "achievements",
  "languages",
  "links",
];

// Unified Resume Data Schema
export const ResumeDataSchema = z.object({
  personalInfo: PersonalInfoSchema.default({}),
  summary: z.preprocess((v) => (v === null || v === undefined ? "" : String(v)), z.string().default("")),
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
    (v) => (Array.isArray(v) && v.length > 0 ? v : DEFAULT_SECTION_ORDER),
    z.array(z.string()).default(DEFAULT_SECTION_ORDER),
  ),
});

export type ResumeData = z.infer<typeof ResumeDataSchema>;

// Full Domain Resume Schema (compatible with Phase 0 AI schemas and Phase 2 models)
export const ResumeSchema = z.object({
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
  customSections: z
    .array(
      z.object({
        heading: z.string(),
        items: z.array(z.string()),
      }),
    )
    .default([]),
  sectionVisibility: SectionVisibilitySchema.default({}),
  sectionOrder: z.array(z.string()).default(DEFAULT_SECTION_ORDER),
  resumeData: ResumeDataSchema.optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Resume = z.infer<typeof ResumeSchema>;

// Default Resume Data Factory
export function createDefaultResumeData(fullName = ""): ResumeData {
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
      portfolioUrl: "",
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
      showLinks: true,
    },
    sectionOrder: [...DEFAULT_SECTION_ORDER],
  };
}
