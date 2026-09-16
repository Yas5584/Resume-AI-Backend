import { z } from "zod";
import { ResumeDataSchema } from "./resume.schema.js";

// --- Import Status ---

export const ImportStatusEnum = z.enum([
  "PENDING",
  "EXTRACTING",
  "PARSING",
  "VALIDATING",
  "COMPLETED",
  "FAILED",
]);

export type ImportStatus = z.infer<typeof ImportStatusEnum>;

// --- Parse Confidence ---

const ConfidenceScoreSchema = z.preprocess((val) => {
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
}, z.number().min(0).max(1).default(0.8));

export const ParseConfidenceSchema = z.preprocess((val) => {
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
      overall: num,
    };
  }
  if (val && typeof val === "object") {
    return val;
  }
  return {};
}, z.object({
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
  overall: ConfidenceScoreSchema,
}).default({}));

export type ParseConfidence = z.infer<typeof ParseConfidenceSchema>;

const ResumeParseResultObjectSchema = z.object({
  resumeData: ResumeDataSchema,
  confidence: ParseConfidenceSchema.default({}),
  warnings: z.preprocess((v) => {
    if (Array.isArray(v)) return v.map(String);
    if (typeof v === "string") return [v];
    return [];
  }, z.array(z.string()).default([])),
});

export type ResumeParseResult = z.infer<typeof ResumeParseResultObjectSchema>;

export const ResumeParseResultSchema: z.ZodType<ResumeParseResult, z.ZodTypeDef, any> = z.preprocess((rawVal: any) => {
  let val = rawVal;
  if (!val) return { resumeData: {} };
  if (typeof val === "string") {
    try {
      val = JSON.parse(val);
    } catch {
      return { resumeData: {} };
    }
  }
  if (Array.isArray(val)) {
    if (val.length === 1 && val[0]?.resumeData) {
      return val[0];
    }
    const merged = Object.assign({}, ...val.filter((v: any) => v && typeof v === "object"));
    if (merged.resumeData) {
      return merged;
    }
    return {
      resumeData: merged,
      confidence: merged.confidence || {},
      warnings: Array.isArray(merged.warnings) ? merged.warnings : [],
    };
  }
  if (typeof val !== "object") return { resumeData: {} };
  // If the LLM returned resumeData directly at the root
  if (!val.resumeData && (val.personalInfo || val.experience || val.education || val.skills || val.summary || val.projects)) {
    return {
      resumeData: val,
      confidence: val.confidence || {},
      warnings: Array.isArray(val.warnings) ? val.warnings : [],
    };
  }
  return val;
}, ResumeParseResultObjectSchema);

// --- Import Constants ---

/** Maximum upload file size: 10 MB */
export const MAX_IMPORT_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Allowed MIME types for resume import */
export const ALLOWED_IMPORT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

/** Allowed file extensions for resume import */
export const ALLOWED_IMPORT_EXTENSIONS = [".pdf", ".docx"] as const;

// --- Extracted Document Schemas ---

export const ExtractedPageSchema = z.object({
  pageNumber: z.number().int().min(1),
  text: z.string(),
  characterCount: z.number().int().min(0),
  wordCount: z.number().int().min(0),
  hasColumns: z.boolean().optional(),
});

export type ExtractedPage = z.infer<typeof ExtractedPageSchema>;

export const ExtractedDocumentSchema = z.object({
  fileType: z.enum(["pdf", "docx"]),
  pageCount: z.number().int().min(1),
  actualPageCount: z.number().int().min(1),
  pages: z.array(ExtractedPageSchema),
  totalCharacters: z.number().int().min(0),
  totalWords: z.number().int().min(0),
  rawText: z.string(),
  structuredText: z.string(),
  warnings: z.array(z.string()).default([]),
  isScannedOrImageOnly: z.boolean().default(false),
  metadata: z.record(z.any()).default({}),
});

export type ExtractedDocument = z.infer<typeof ExtractedDocumentSchema>;

// --- Import Detected Counts ---

export const ImportDetectedCountsSchema = z.object({
  experience: z.number().int().min(0).default(0),
  projects: z.number().int().min(0).default(0),
  skills: z.number().int().min(0).default(0),
  education: z.number().int().min(0).default(0),
  certifications: z.number().int().min(0).default(0),
  languages: z.number().int().min(0).default(0),
  links: z.number().int().min(0).default(0),
});

export type ImportDetectedCounts = z.infer<typeof ImportDetectedCountsSchema>;

// --- Import Response Schema ---

export const ImportMetadataSchema = z.object({
  importId: z.string().uuid(),
  status: ImportStatusEnum,
  originalFilename: z.string(),
  mimeType: z.string(),
  fileSizeBytes: z.number(),
  pageCount: z.number().int().optional(),
  actualPageCount: z.number().int().optional(),
  extractedWordCount: z.number().int().optional(),
  extractedCharCount: z.number().int().optional(),
  detectedCounts: ImportDetectedCountsSchema.optional(),
  confidence: ParseConfidenceSchema.optional(),
  warnings: z.array(z.string()).default([]),
  extractionWarnings: z.array(z.string()).default([]),
  parserWarnings: z.array(z.string()).default([]),
  processingTimeMs: z.number().optional(),
  aiTokensUsed: z.number().default(0),
});

export type ImportMetadata = z.infer<typeof ImportMetadataSchema>;
