import { describe, it, expect } from "vitest";
import {
  MatchAnalysisSchema,
  MatchComponentSchema,
  MatchedSkillItemSchema,
  MatchedRequirementItemSchema,
  MatchStrengthSchema,
  MatchGapSchema,
  MatchRecommendationSchema,
  MATCH_SCORE_VERSION,
  DEFAULT_MATCH_SCORE_WEIGHTS,
  getMatchScoreLabel,
} from "../src/schemas/job.schema.js";
import { CreateMatchRequestSchema } from "../src/schemas/api.schema.js";

describe("Match Analysis Schemas (Phase 7)", () => {
  it("should validate score weights configuration totaling 100%", () => {
    const totalWeight =
      DEFAULT_MATCH_SCORE_WEIGHTS.requiredRequirements +
      DEFAULT_MATCH_SCORE_WEIGHTS.preferredSkills +
      DEFAULT_MATCH_SCORE_WEIGHTS.experience +
      DEFAULT_MATCH_SCORE_WEIGHTS.responsibilities +
      DEFAULT_MATCH_SCORE_WEIGHTS.keywords +
      DEFAULT_MATCH_SCORE_WEIGHTS.education +
      DEFAULT_MATCH_SCORE_WEIGHTS.certifications;

    expect(totalWeight).toBe(100);
    expect(MATCH_SCORE_VERSION).toBe("v1");
  });

  it("should map score numbers to correct transparent labels", () => {
    expect(getMatchScoreLabel(95)).toBe("Strong Match");
    expect(getMatchScoreLabel(90)).toBe("Strong Match");
    expect(getMatchScoreLabel(89)).toBe("Good Match");
    expect(getMatchScoreLabel(75)).toBe("Good Match");
    expect(getMatchScoreLabel(74)).toBe("Moderate Match");
    expect(getMatchScoreLabel(60)).toBe("Moderate Match");
    expect(getMatchScoreLabel(59)).toBe("Weak Match");
    expect(getMatchScoreLabel(40)).toBe("Weak Match");
    expect(getMatchScoreLabel(39)).toBe("Low Match");
    expect(getMatchScoreLabel(0)).toBe("Low Match");
  });

  it("should validate valid MatchComponent", () => {
    const validComponent = {
      score: 80,
      weight: 35,
      weightedScore: 28,
      matchedCount: 4,
      totalCount: 5,
      details: "4 of 5 required skills matched",
    };

    const parsed = MatchComponentSchema.safeParse(validComponent);
    expect(parsed.success).toBe(true);
  });

  it("should reject MatchComponent with score out of bounds", () => {
    expect(
      MatchComponentSchema.safeParse({
        score: -5,
        weight: 35,
        weightedScore: 0,
        matchedCount: 0,
        totalCount: 1,
      }).success,
    ).toBe(false);

    expect(
      MatchComponentSchema.safeParse({
        score: 105,
        weight: 35,
        weightedScore: 35,
        matchedCount: 1,
        totalCount: 1,
      }).success,
    ).toBe(false);
  });

  it("should validate MatchedSkillItem with evidence and state", () => {
    const skillItem = {
      skill: "React",
      normalizedSkill: "React",
      importance: "REQUIRED",
      matchType: "MATCHED",
      resumeEvidence: ["Built React web apps for 3 years"],
      jobEvidence: "3+ years React required",
      confidence: 0.98,
    };

    const parsed = MatchedSkillItemSchema.safeParse(skillItem);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.matchType).toBe("MATCHED");
      expect(parsed.data.resumeEvidence).toHaveLength(1);
    }
  });

  it("should validate complete MatchAnalysisSchema", () => {
    const dummyComponent = {
      score: 80,
      weight: 35,
      weightedScore: 28,
      matchedCount: 4,
      totalCount: 5,
    };

    const validMatch = {
      scoreVersion: "v1",
      overallScore: 82,
      scoreLabel: "Good Match",
      skillMatch: dummyComponent,
      experienceMatch: {
        score: 90,
        weight: 20,
        weightedScore: 18,
        matchedCount: 5,
        totalCount: 5,
      },
      responsibilityAlignment: {
        score: 85,
        weight: 15,
        weightedScore: 12.75,
        matchedCount: 3,
        totalCount: 4,
      },
      keywordCoverage: {
        score: 75,
        weight: 15,
        weightedScore: 11.25,
        matchedCount: 6,
        totalCount: 8,
      },
      educationMatch: {
        score: 100,
        weight: 7.5,
        weightedScore: 7.5,
        matchedCount: 1,
        totalCount: 1,
      },
      certificationMatch: {
        score: 60,
        weight: 7.5,
        weightedScore: 4.5,
        matchedCount: 1,
        totalCount: 1,
      },
      matchedSkills: [
        {
          skill: "TypeScript",
          normalizedSkill: "TypeScript",
          importance: "REQUIRED",
          matchType: "MATCHED",
          resumeEvidence: ["5 years TypeScript"],
          confidence: 0.95,
        },
      ],
      missingSkills: [
        {
          skill: "AWS",
          normalizedSkill: "AWS",
          importance: "PREFERRED",
          matchType: "MISSING",
          resumeEvidence: [],
          confidence: 1.0,
          reason: "Not found in the resume",
        },
      ],
      partialSkills: [],
      matchedRequirements: [],
      missingRequirements: [],
      strengths: [
        {
          title: "Strong TypeScript Alignment",
          detail: "Demonstrated deep production experience in TypeScript.",
          evidence: ["5 years TypeScript"],
          category: "TECHNICAL",
        },
      ],
      gaps: [
        {
          title: "AWS Experience Not Found",
          detail: "AWS is a preferred skill but was not found in the resume.",
          importance: "PREFERRED",
          missingType: "SKILL",
          critical: false,
          remedyHint: "Review whether AWS was used in projects but omitted.",
        },
      ],
      recommendations: [
        {
          title: "Highlight Cloud Experience",
          description:
            "If you have cloud experience, consider adding evidence to relevant work history.",
          priority: "MEDIUM",
          actionable: true,
        },
      ],
      isStale: false,
    };

    const parsed = MatchAnalysisSchema.safeParse(validMatch);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.overallScore).toBe(82);
      expect(parsed.data.scoreLabel).toBe("Good Match");
      expect(parsed.data.missingSkills[0].reason).toBe(
        "Not found in the resume",
      );
    }
  });

  it("should validate CreateMatchRequestSchema with valid UUIDs", () => {
    const validRequest = {
      resumeId: "123e4567-e89b-12d3-a456-426614174000",
      jobId: "123e4567-e89b-12d3-a456-426614174001",
    };

    expect(CreateMatchRequestSchema.safeParse(validRequest).success).toBe(true);
    expect(
      CreateMatchRequestSchema.safeParse({
        resumeId: "not-uuid",
        jobId: "not-uuid",
      }).success,
    ).toBe(false);
  });
});
