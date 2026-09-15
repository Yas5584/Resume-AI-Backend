import { describe, it, expect } from "vitest";
import {
  RESUME_STRATEGY_VERSION,
  DEFAULT_PRESERVATION_RULES,
  DEFAULT_PROHIBITED_CHANGES,
  StrategyApprovalStatusEnum,
  SectionStrategyActionEnum,
  SectionStrategySchema,
  MissingSkillRecommendationSchema,
  SkillStrategySchema,
  KeywordClassificationEnum,
  KeywordStrategySchema,
  ExperienceStrategyItemSchema,
  ProjectStrategyItemSchema,
  GapStrategySchema,
  ResumeStrategySchema,
  CreateStrategyRequestSchema,
  UpdateStrategyStatusRequestSchema,
} from "../src/schemas/strategy.schema.js";

describe("Resume Strategy Schemas (Phase 8)", () => {
  it("should have correct version and default preservation rules", () => {
    expect(RESUME_STRATEGY_VERSION).toBe("v1");
    expect(DEFAULT_PRESERVATION_RULES.length).toBe(6);
    expect(DEFAULT_PRESERVATION_RULES.map((r) => r.rule)).toContain(
      "PRESERVE_EMPLOYMENT_DATES",
    );
    expect(DEFAULT_PRESERVATION_RULES.map((r) => r.rule)).toContain(
      "PRESERVE_EMPLOYER_NAMES",
    );
    expect(DEFAULT_PRESERVATION_RULES.map((r) => r.rule)).toContain(
      "PRESERVE_EDUCATION_CREDENTIALS",
    );
    expect(DEFAULT_PRESERVATION_RULES.map((r) => r.rule)).toContain(
      "PRESERVE_VERIFIED_CERTIFICATIONS",
    );
    expect(DEFAULT_PRESERVATION_RULES.map((r) => r.rule)).toContain(
      "PRESERVE_FACTUAL_METRICS",
    );
    expect(DEFAULT_PRESERVATION_RULES.map((r) => r.rule)).toContain(
      "PRESERVE_EXISTING_JOB_TITLES",
    );
  });

  it("should have correct default prohibited changes", () => {
    expect(DEFAULT_PROHIBITED_CHANGES.length).toBe(10);
    expect(DEFAULT_PROHIBITED_CHANGES.map((p) => p.rule)).toContain(
      "DO_NOT_INVENT_EMPLOYER",
    );
    expect(DEFAULT_PROHIBITED_CHANGES.map((p) => p.rule)).toContain(
      "DO_NOT_INVENT_JOB_TITLE",
    );
    expect(DEFAULT_PROHIBITED_CHANGES.map((p) => p.rule)).toContain(
      "DO_NOT_CLAIM_UNSUPPORTED_SKILL",
    );
    expect(DEFAULT_PROHIBITED_CHANGES.map((p) => p.rule)).toContain(
      "DO_NOT_UPGRADE_JOB_TITLE",
    );
  });

  it("should validate approval statuses", () => {
    expect(StrategyApprovalStatusEnum.safeParse("DRAFT").success).toBe(true);
    expect(StrategyApprovalStatusEnum.safeParse("REVIEWED").success).toBe(true);
    expect(StrategyApprovalStatusEnum.safeParse("APPROVED").success).toBe(true);
    expect(StrategyApprovalStatusEnum.safeParse("REJECTED").success).toBe(
      false,
    );
  });

  it("should validate allowed section actions", () => {
    const allowed = [
      "EMPHASIZE",
      "MAINTAIN",
      "CONDENSE",
      "REORDER",
      "OPTIONAL",
      "OMIT_IF_EMPTY",
    ];
    for (const act of allowed) {
      expect(SectionStrategyActionEnum.safeParse(act).success).toBe(true);
    }
    expect(SectionStrategyActionEnum.safeParse("FABRICATE").success).toBe(
      false,
    );
  });

  it("should validate SectionStrategy priorities strictly between 1 and 5", () => {
    const valid = {
      section: "experience",
      action: "EMPHASIZE",
      priority: 1,
      reason: "High alignment with primary requirements",
      evidence: ["CloudScale Systems"],
      confidence: 0.95,
    };
    expect(SectionStrategySchema.safeParse(valid).success).toBe(true);

    const invalidLow = { ...valid, priority: 0 };
    expect(SectionStrategySchema.safeParse(invalidLow).success).toBe(false);

    const invalidHigh = { ...valid, priority: 6 };
    expect(SectionStrategySchema.safeParse(invalidHigh).success).toBe(false);
  });

  it("should enforce strict DO_NOT_CLAIM invariant on missing skills", () => {
    const validMissing = {
      skill: "Kubernetes",
      reason: "Not evidenced in current resume.",
      action: "DO_NOT_CLAIM",
      advisoryNote:
        "Consider highlighting only if candidate has authentic experience.",
    };
    expect(
      MissingSkillRecommendationSchema.safeParse(validMissing).success,
    ).toBe(true);

    const invalidAction = {
      skill: "Kubernetes",
      reason: "Candidate should claim this",
      action: "ADD_TO_RESUME",
    };
    expect(
      MissingSkillRecommendationSchema.safeParse(invalidAction).success,
    ).toBe(false);
  });

  it("should validate complete ResumeStrategySchema", () => {
    const validStrategy = {
      resumeId: "11111111-1111-1111-1111-111111111111",
      jobId: "22222222-2222-2222-2222-222222222222",
      overallApproach:
        "Prioritize backend systems experience and database scaling.",
      sectionStrategies: [
        {
          section: "experience",
          action: "EMPHASIZE",
          priority: 1,
          reason: "Key career accomplishments align with role.",
          evidence: ["Company A"],
        },
      ],
      skillStrategy: {
        emphasize: [
          {
            skill: "TypeScript",
            source: "both",
            reason: "Target job core requirement.",
            evidence: ["TypeScript"],
          },
        ],
        maintain: [],
        deemphasize: [],
        missing: [
          {
            skill: "AWS",
            reason: "Not evidenced in current resume.",
            action: "DO_NOT_CLAIM",
          },
        ],
      },
      keywordStrategy: {
        keywords: [
          {
            keyword: "TypeScript",
            classification: "SAFE_TO_SURFACE",
            resumeEvidence: ["TypeScript"],
            jobEvidence: ["TypeScript"],
          },
        ],
      },
      experienceStrategy: {
        items: [
          {
            experienceId: "exp-1",
            company: "Tech Corp",
            jobTitle: "Senior Engineer",
            priority: 1,
            actions: ["EMPHASIZE_RELEVANT_RESPONSIBILITIES"],
            reason: "Core relevance",
            evidence: ["TypeScript", "PostgreSQL"],
          },
        ],
      },
      projectStrategy: {
        items: [],
      },
      gapStrategy: {
        gaps: [
          {
            requirement: "AWS",
            classification: "MISSING_REQUIRED",
            recommendation: "DO_NOT_CLAIM",
            reason: "Not evidenced in current resume.",
          },
        ],
      },
    };

    const parsed = ResumeStrategySchema.safeParse(validStrategy);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.strategyVersion).toBe("v1");
      expect(parsed.data.status).toBe("DRAFT");
      expect(parsed.data.preservationRules.length).toBe(6);
      expect(parsed.data.prohibitedChanges.length).toBe(10);
    }
  });

  it("should validate API request schemas", () => {
    const validCreate = {
      resumeId: "11111111-1111-1111-1111-111111111111",
      jobId: "22222222-2222-2222-2222-222222222222",
    };
    expect(CreateStrategyRequestSchema.safeParse(validCreate).success).toBe(
      true,
    );

    const invalidCreate = { resumeId: "not-a-uuid", jobId: "123" };
    expect(CreateStrategyRequestSchema.safeParse(invalidCreate).success).toBe(
      false,
    );

    expect(
      UpdateStrategyStatusRequestSchema.safeParse({ status: "APPROVED" })
        .success,
    ).toBe(true);
    expect(
      UpdateStrategyStatusRequestSchema.safeParse({ status: "INVALID" })
        .success,
    ).toBe(false);
  });

  it("should validate Phase 8 overview, requirementStrategy, riskFlags, and protectedFacts", () => {
    const fullPhase8Strategy = {
      resumeId: "11111111-1111-1111-1111-111111111111",
      jobId: "22222222-2222-2222-2222-222222222222",
      overallApproach:
        "Tailor resume highlighting full-stack experience and verified skills.",
      overview: {
        objective: "Target Senior Full Stack role",
        overallApproach:
          "Tailor resume highlighting full-stack experience and verified skills.",
        prioritySummary:
          "Emphasize React and Node.js; preserve truthful boundaries for cloud.",
      },
      sectionStrategies: [
        {
          section: "experience",
          priority: "HIGH",
          reason: "Directly relates to required responsibilities",
          actions: [
            {
              action: "EMPHASIZE",
              reason: "Demonstrates backend Node.js proficiency",
              targetRequirementIds: ["req-1"],
              evidenceIds: ["exp-1"],
              priority: "HIGH",
              confidence: 0.95,
            },
          ],
        },
      ],
      skillStrategy: {
        emphasize: [],
        maintain: [],
        deemphasize: [],
        missing: [
          {
            skill: "Kubernetes",
            reason: "Not evidenced in current resume.",
            action: "DO_NOT_CLAIM",
          },
        ],
      },
      keywordStrategy: {
        keywords: [],
        mustNaturallyInclude: [
          {
            keyword: "REST APIs",
            requirementId: "req-1",
            evidenceIds: ["exp-1"],
            reason: "Demonstrated in work experience",
          },
        ],
        alreadyCovered: [{ keyword: "TypeScript", evidenceIds: ["skill-1"] }],
        missingAndUnsafe: [
          {
            keyword: "Kubernetes",
            requirementId: "req-2",
            reason:
              "Zero evidence found in candidate background. DO NOT INVENT.",
          },
        ],
      },
      experienceStrategy: { items: [] },
      projectStrategy: { items: [] },
      gapStrategy: { gaps: [] },
      requirementStrategy: [
        {
          requirementId: "req-1",
          status: "MATCHED",
          strategy: "EMPHASIZE_EXISTING_EVIDENCE",
          evidenceIds: ["exp-1"],
          reason: "Candidate has 4 years Node.js experience.",
          priority: "HIGH",
        },
        {
          requirementId: "req-2",
          status: "MISSING",
          strategy: "DO_NOT_INVENT",
          evidenceIds: [],
          reason: "No Kubernetes evidence. Strictly maintain truthfulness.",
          priority: "HIGH",
        },
      ],
      riskFlags: [
        {
          type: "MISSING_EVIDENCE",
          description:
            "Candidate does not possess Kubernetes experience required by job.",
          evidenceIds: [],
          severity: "HIGH",
        },
      ],
      protectedFacts: [
        {
          field: "employerName",
          value: "Tech Corp",
          evidenceIds: ["exp-1"],
          reason: "Employer name must not be modified or upgraded.",
        },
      ],
      generatedAt: new Date().toISOString(),
    };

    const parsed = ResumeStrategySchema.safeParse(fullPhase8Strategy);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.overview?.objective).toBe(
        "Target Senior Full Stack role",
      );
      expect(parsed.data.keywordStrategy.mustNaturallyInclude.length).toBe(1);
      expect(parsed.data.keywordStrategy.missingAndUnsafe.length).toBe(1);
      expect(parsed.data.requirementStrategy.length).toBe(2);
      expect(parsed.data.riskFlags[0].type).toBe("MISSING_EVIDENCE");
      expect(parsed.data.protectedFacts[0].field).toBe("employerName");
    }
  });
});
