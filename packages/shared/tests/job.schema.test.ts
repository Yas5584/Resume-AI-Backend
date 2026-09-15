import { describe, it, expect } from "vitest";
import {
  JobAnalysisSchema,
  JobKeywordSchema,
  SkillRequirementSchema,
  ResponsibilitySchema,
  ExperienceRequirementSchema,
  EducationRequirementSchema,
  CertificationRequirementSchema,
  RequirementSchema,
  SeniorityEnum,
  RequirementImportanceEnum,
  WorkArrangementEnum,
} from "../src/schemas/job.schema.js";

describe("Job Analysis Schemas (Phase 6)", () => {
  it("should validate a complete JobAnalysis object", () => {
    const validAnalysis = {
      jobTitle: "Senior Software Engineer",
      company: "Acme Corp",
      seniority: "SENIOR",
      summary: "Lead full stack developer role.",
      responsibilities: [
        {
          text: "Design microservices",
          importance: "REQUIRED",
          evidence: "Design microservices",
          confidence: 0.95,
        },
      ],
      requirements: [
        {
          text: "React experience",
          category: "REQUIRED_SKILL",
          importance: "REQUIRED",
          explicit: true,
          evidence: "React required",
          confidence: 0.98,
          relationship: null,
          relatedRequirements: [],
        },
      ],
      skills: [
        {
          name: "React",
          normalizedName: "React",
          category: "REQUIRED_SKILL",
          importance: "REQUIRED",
          explicit: true,
          evidence: "React required",
          confidence: 0.98,
        },
      ],
      education: [
        {
          degree: "Bachelor's",
          field: "Computer Science",
          minimum: true,
          preferred: false,
          importance: "REQUIRED",
          explicit: true,
          evidence: "BS in CS required",
          confidence: 0.95,
        },
      ],
      certifications: [
        {
          name: "AWS Certified Developer",
          importance: "PREFERRED",
          explicit: true,
          evidence: "AWS cert preferred",
          confidence: 0.9,
        },
      ],
      experience: [
        {
          yearsMin: 5,
          yearsMax: null,
          domain: "web development",
          management: false,
          importance: "REQUIRED",
          explicit: true,
          evidence: "5+ years experience",
          confidence: 0.95,
        },
      ],
      keywords: [
        {
          keyword: "React",
          category: "TECHNICAL",
          importance: "REQUIRED",
          frequency: 4,
          evidence: "React",
          confidence: 0.98,
        },
      ],
      workArrangement: "HYBRID",
      location: "San Francisco, CA",
      industry: "SaaS",
      workAuthorization: null,
    };

    const result = JobAnalysisSchema.safeParse(validAnalysis);
    expect(result.success).toBe(true);
  });

  it("should accept null company and unknown seniority", () => {
    const minimal = {
      jobTitle: null,
      company: null,
      seniority: "UNKNOWN",
      summary: null,
      responsibilities: [],
      requirements: [],
      skills: [],
      education: [],
      certifications: [],
      experience: [],
      keywords: [],
      workArrangement: null,
      location: null,
      industry: null,
      workAuthorization: null,
    };

    const result = JobAnalysisSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.company).toBeNull();
      expect(result.data.seniority).toBe("UNKNOWN");
    }
  });

  it("should reject invalid confidence scores (< 0 or > 1)", () => {
    const invalidKeyword = {
      keyword: "TypeScript",
      category: "TECHNICAL",
      importance: "REQUIRED",
      frequency: 2,
      evidence: "TypeScript",
      confidence: 1.5, // invalid
    };

    const result = JobKeywordSchema.safeParse(invalidKeyword);
    expect(result.success).toBe(false);
  });

  it("should reject invalid keyword frequency (< 1)", () => {
    const invalidKeyword = {
      keyword: "TypeScript",
      category: "TECHNICAL",
      importance: "REQUIRED",
      frequency: 0, // invalid
      evidence: "TypeScript",
      confidence: 0.9,
    };

    const result = JobKeywordSchema.safeParse(invalidKeyword);
    expect(result.success).toBe(false);
  });

  it("should validate conditional OR/AND requirement relationships", () => {
    const orReq = {
      text: "React or Vue experience",
      category: "REQUIRED_SKILL",
      importance: "REQUIRED",
      explicit: true,
      evidence: "React or Vue",
      confidence: 0.95,
      relationship: "OR",
      relatedRequirements: ["React", "Vue"],
    };

    const result = RequirementSchema.safeParse(orReq);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.relationship).toBe("OR");
      expect(result.data.relatedRequirements).toEqual(["React", "Vue"]);
    }
  });

  it("should validate skill importance levels including PREFERRED and NICE_TO_HAVE", () => {
    const skill = {
      name: "Docker",
      normalizedName: "Docker",
      category: "TOOL",
      importance: "NICE_TO_HAVE",
      explicit: true,
      evidence: "Docker is a plus",
      confidence: 0.85,
    };

    const result = SkillRequirementSchema.safeParse(skill);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.importance).toBe("NICE_TO_HAVE");
    }
  });

  it("should validate experience requirements with management flag", () => {
    const exp = {
      yearsMin: 7,
      yearsMax: 10,
      domain: "engineering management",
      management: true,
      importance: "REQUIRED",
      explicit: true,
      evidence: "7-10 years including management",
      confidence: 0.95,
    };

    const result = ExperienceRequirementSchema.safeParse(exp);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.management).toBe(true);
      expect(result.data.yearsMin).toBe(7);
      expect(result.data.yearsMax).toBe(10);
    }
  });

  it("should validate education and certification requirements", () => {
    const edu = {
      degree: "Master's",
      field: "Data Science",
      minimum: false,
      preferred: true,
      importance: "PREFERRED",
      explicit: true,
      evidence: "Master's preferred",
      confidence: 0.9,
    };
    expect(EducationRequirementSchema.safeParse(edu).success).toBe(true);

    const cert = {
      name: "CISSP",
      importance: "REQUIRED",
      explicit: true,
      evidence: "CISSP required",
      confidence: 1.0,
    };
    expect(CertificationRequirementSchema.safeParse(cert).success).toBe(true);
  });
});
