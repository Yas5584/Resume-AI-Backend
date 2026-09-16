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

export const SECTION_NOISE_REGEX =
  /^(education|projects?|skills?|technical\s*skills|certifications?|achievements?|languages?|links?|experience|work\s*experience|professional\s*experience|summary|professional\s*summary|personal\s*info|contact|interests|awards|references|competencies|technologies|[:;,\-–—|•*#\s]+)$/i;

export function tryParseJsonObject(val: unknown): unknown {
  if (typeof val !== "string") return val;
  const trimmed = val.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return val;
  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      } catch {}
    }
  }
  return val;
}

export function isDummyExperience(obj: any): boolean {
  if (!obj || typeof obj !== "object") return true;
  const title = String(obj.jobTitle || obj.position || obj.title || obj.role || "").trim();
  const company = String(obj.company || obj.organization || obj.employer || "").trim();
  const desc = String(obj.description || "").trim();
  const bullets = Array.isArray(obj.bullets) ? obj.bullets.filter(Boolean) : [];
  const start = String(obj.startDate || "").trim();

  if (SECTION_NOISE_REGEX.test(title)) return true;
  if (
    (!title || title === "Role") &&
    (!company || company === "Company") &&
    !desc &&
    bullets.length === 0 &&
    !start
  ) {
    return true;
  }
  return false;
}

export function isDummyEducation(obj: any): boolean {
  if (!obj || typeof obj !== "object") return true;
  const inst = String(obj.institution || obj.school || obj.university || "").trim();
  const deg = String(obj.degree || obj.qualification || "").trim();
  const field = String(obj.fieldOfStudy || "").trim();
  const desc = String(obj.description || "").trim();
  const start = String(obj.startDate || "").trim();

  if (SECTION_NOISE_REGEX.test(inst)) return true;
  if (
    (!inst || inst === "Institution") &&
    (!deg || deg === "Degree") &&
    !field &&
    !desc &&
    !start
  ) {
    return true;
  }
  return false;
}

export function isDummyProject(obj: any): boolean {
  if (!obj || typeof obj !== "object") return true;
  const name = String(obj.name || obj.title || "").trim();
  const desc = String(obj.description || "").trim();
  const bullets = Array.isArray(obj.bullets) ? obj.bullets.filter(Boolean) : [];
  const techs = Array.isArray(obj.technologies) ? obj.technologies.filter(Boolean) : [];

  if (SECTION_NOISE_REGEX.test(name)) return true;
  if ((!name || name === "Project") && !desc && bullets.length === 0 && techs.length === 0) {
    return true;
  }
  return false;
}

// Helper for array normalization
const ensureArray = <T extends z.ZodTypeAny>(
  itemSchema: T,
  isDummyItem?: (item: any) => boolean,
) =>
  z.preprocess((val) => {
    if (val === null || val === undefined) return [];
    let rawArr = Array.isArray(val) ? val : [val];
    rawArr = rawArr.flat(2);
    const cleaned: any[] = [];
    for (let item of rawArr) {
      if (item === null || item === undefined || item === "") continue;
      item = tryParseJsonObject(item);
      if (typeof item === "string") {
        const trimmed = item.trim();
        if (SECTION_NOISE_REGEX.test(trimmed) || trimmed.length < 3) continue;
      }
      if (item && typeof item === "object" && isDummyItem && isDummyItem(item)) {
        continue;
      }
      cleaned.push(item);
    }
    return cleaned;
  }, z.array(itemSchema).default([]));

// 2. Work Experience Schema
export const WorkExperienceSchema = z.preprocess((rawVal) => {
  const val = tryParseJsonObject(rawVal);
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (SECTION_NOISE_REGEX.test(trimmed) || trimmed.length < 3) {
      return null;
    }
    return {
      jobTitle: trimmed.slice(0, 100),
      company: "Company",
      description: trimmed,
      bullets: [trimmed],
    };
  }
  if (val && typeof val === "object") {
    const obj = { ...val } as any;
    const title = (obj.jobTitle || obj.position || obj.title || obj.role || "").trim();
    if (SECTION_NOISE_REGEX.test(title)) {
      return null;
    }
    obj.jobTitle = title || "Role";
    obj.position = obj.position || obj.jobTitle;
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
export const EducationSchema = z.preprocess((rawVal) => {
  const val = tryParseJsonObject(rawVal);
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (SECTION_NOISE_REGEX.test(trimmed) || trimmed.length < 3) {
      return null;
    }
    return {
      institution: trimmed,
      degree: "Degree",
      description: trimmed,
    };
  }
  if (val && typeof val === "object") {
    const obj = { ...val } as any;
    const inst = (obj.institution || obj.school || obj.university || obj.college || "").trim();
    if (SECTION_NOISE_REGEX.test(inst)) {
      return null;
    }
    if (!obj.institution && inst) {
      obj.institution = inst;
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
export const ProjectSchema = z.preprocess((rawVal) => {
  const val = tryParseJsonObject(rawVal);
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (SECTION_NOISE_REGEX.test(trimmed) || trimmed.length < 3) {
      return null;
    }
    return {
      name: trimmed.slice(0, 100),
      description: trimmed,
      bullets: [trimmed],
    };
  }
  if (val && typeof val === "object") {
    const obj = { ...val } as any;
    const name = (obj.name || obj.title || obj.projectName || "").trim();
    if (SECTION_NOISE_REGEX.test(name)) {
      return null;
    }
    if (!obj.name && name) {
      obj.name = name;
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
export const SkillCategorySchema = z.preprocess((rawVal) => {
  const val = tryParseJsonObject(rawVal);
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (SECTION_NOISE_REGEX.test(trimmed) || trimmed.length < 2) {
      return null;
    }
    return {
      category: "Skills",
      skills: [trimmed],
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

const SkillsArraySchema = z.preprocess((rawVal) => {
  if (!rawVal) return [];
  const val = tryParseJsonObject(rawVal);
  if (typeof val === "string") {
    const parts = val.split(/[,;\n]+/).map((s) => s.trim()).filter((s) => s && !SECTION_NOISE_REGEX.test(s));
    if (parts.length > 0) {
      return [{ category: "Skills", skills: parts }];
    }
    return [];
  }
  if (Array.isArray(val)) {
    if (val.length > 0 && typeof val[0] === "string") {
      const parts = val.map((s) => String(s).trim()).filter((s) => s && !SECTION_NOISE_REGEX.test(s));
      return [{ category: "Skills", skills: parts }];
    }
    return val;
  }
  if (val && typeof val === "object") {
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
  experience: ensureArray(WorkExperienceSchema, isDummyExperience),
  education: ensureArray(EducationSchema, isDummyEducation),
  projects: ensureArray(ProjectSchema, isDummyProject),
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
