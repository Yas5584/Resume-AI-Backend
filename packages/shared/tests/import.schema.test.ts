import { describe, it, expect } from "vitest";
import {
  ResumeParseResultSchema,
  ParseConfidenceSchema,
  ImportStatusEnum,
  MAX_IMPORT_FILE_SIZE_BYTES,
  ALLOWED_IMPORT_MIME_TYPES,
  ALLOWED_IMPORT_EXTENSIONS,
  createDefaultResumeData,
} from "../src/index.js";

describe("Import Schemas (Phase 5)", () => {
  describe("Import Constants and Enums", () => {
    it("should export correct file limits and extensions", () => {
      expect(MAX_IMPORT_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
      expect(ALLOWED_IMPORT_EXTENSIONS).toContain(".pdf");
      expect(ALLOWED_IMPORT_EXTENSIONS).toContain(".docx");
      expect(ALLOWED_IMPORT_MIME_TYPES).toContain("application/pdf");
      expect(ALLOWED_IMPORT_MIME_TYPES).toContain(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
    });

    it("should validate all ImportStatusEnum values", () => {
      expect(ImportStatusEnum.parse("PENDING")).toBe("PENDING");
      expect(ImportStatusEnum.parse("EXTRACTING")).toBe("EXTRACTING");
      expect(ImportStatusEnum.parse("PARSING")).toBe("PARSING");
      expect(ImportStatusEnum.parse("VALIDATING")).toBe("VALIDATING");
      expect(ImportStatusEnum.parse("COMPLETED")).toBe("COMPLETED");
      expect(ImportStatusEnum.parse("FAILED")).toBe("FAILED");
      expect(() => ImportStatusEnum.parse("UNKNOWN_STATUS")).toThrow();
    });
  });

  describe("ParseConfidenceSchema", () => {
    it("should accept valid confidence scores within 0.0 to 1.0", () => {
      const valid = ParseConfidenceSchema.parse({
        personalInfo: 0.95,
        summary: 0.8,
        experience: 0.9,
        education: 0.85,
        skills: 0.7,
        projects: 0.0,
        certifications: 0.0,
        achievements: 0.5,
        languages: 1.0,
        links: 0.0,
        overall: 0.82,
      });

      expect(valid.overall).toBe(0.82);
      expect(valid.personalInfo).toBe(0.95);
    });

    it("should default missing section confidence to 0", () => {
      const defaulted = ParseConfidenceSchema.parse({});
      expect(defaulted.personalInfo).toBe(0);
      expect(defaulted.overall).toBe(0);
      expect(defaulted.experience).toBe(0);
    });

    it("should reject confidence values below 0 or above 1", () => {
      expect(() =>
        ParseConfidenceSchema.parse({
          personalInfo: 1.5,
        }),
      ).toThrow();

      expect(() =>
        ParseConfidenceSchema.parse({
          personalInfo: -0.1,
        }),
      ).toThrow();
    });
  });

  describe("ResumeParseResultSchema", () => {
    it("should validate a complete parse result with populated resume data", () => {
      const mockResult = {
        resumeData: {
          ...createDefaultResumeData("Jane Developer"),
          summary: "Experienced full-stack engineer",
          experience: [
            {
              jobTitle: "Staff Engineer",
              company: "NextGen Tech",
              startDate: "2020-01",
              current: true,
              bullets: ["Architected core data pipeline"],
            },
          ],
        },
        confidence: {
          personalInfo: 0.9,
          summary: 0.85,
          experience: 0.95,
          education: 0.0,
          skills: 0.0,
          projects: 0.0,
          certifications: 0.0,
          achievements: 0.0,
          languages: 0.0,
          links: 0.0,
          overall: 0.9,
        },
        warnings: ["No education history detected in document"],
      };

      const parsed = ResumeParseResultSchema.parse(mockResult);
      expect(parsed.resumeData.personalInfo.fullName).toBe("Jane Developer");
      expect(parsed.resumeData.experience.length).toBe(1);
      expect(parsed.confidence.overall).toBe(0.9);
      expect(parsed.warnings.length).toBe(1);
    });

    it("should validate a minimal/sparse parse result with empty sections", () => {
      const minimalResult = {
        resumeData: createDefaultResumeData(""),
        confidence: {
          personalInfo: 0,
          summary: 0,
          experience: 0,
          education: 0,
          skills: 0,
          projects: 0,
          certifications: 0,
          achievements: 0,
          languages: 0,
          links: 0,
          overall: 0,
        },
        warnings: [],
      };

      const parsed = ResumeParseResultSchema.parse(minimalResult);
      expect(parsed.resumeData.personalInfo.fullName).toBe("");
      expect(parsed.resumeData.experience).toEqual([]);
      expect(parsed.confidence.overall).toBe(0);
      expect(parsed.warnings).toEqual([]);
    });

    it("should reject parse result missing required resumeData structure", () => {
      expect(() =>
        ResumeParseResultSchema.parse({
          resumeData: "not-an-object",
          confidence: {},
          warnings: [],
        }),
      ).toThrow();

      expect(() =>
        ResumeParseResultSchema.parse({
          resumeData: {
            experience: [{ id: "1" }], // missing company & jobTitle
          },
          confidence: {},
          warnings: [],
        }),
      ).toThrow();
    });
  });
});
