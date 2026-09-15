import { describe, it, expect } from "vitest";
import {
  ContentProposalStatusEnum,
  ContentProposalStatusSchema,
  ChangeTypeSchema,
  ChangeSectionSchema,
  ChangeRiskSchema,
  ChangeStatusSchema,
  ResumeContentChangeSchema,
  ContentProposalSummaryStatsSchema,
  ContentProposalDataSchema,
  GenerateContentProposalInputSchema,
  ApplyContentProposalInputSchema,
  UpdateChangeStatusInputSchema,
  RegenerateSectionInputSchema,
  ATSValidationResultSchema,
  SectionRegenerationResponseSchema,
  FactualClaimSchema,
} from "../src/schemas/content-writer.schema.js";

describe("Content Writer Schemas (Phase 9)", () => {
  it("validates ContentProposalStatusEnum and schema", () => {
    expect(ContentProposalStatusEnum.DRAFT).toBe("DRAFT");
    expect(ContentProposalStatusEnum.PARTIALLY_ACCEPTED).toBe(
      "PARTIALLY_ACCEPTED",
    );
    expect(ContentProposalStatusEnum.ACCEPTED).toBe("ACCEPTED");
    expect(ContentProposalStatusEnum.REJECTED).toBe("REJECTED");
    expect(ContentProposalStatusEnum.STALE).toBe("STALE");
    expect(ContentProposalStatusEnum.APPLIED).toBe("APPLIED");

    expect(ContentProposalStatusSchema.parse("DRAFT")).toBe("DRAFT");
    expect(ContentProposalStatusSchema.parse("APPLIED")).toBe("APPLIED");
    expect(() => ContentProposalStatusSchema.parse("INVALID_STATUS")).toThrow();
  });

  it("validates ChangeTypeSchema and ChangeSectionSchema", () => {
    const validTypes = [
      "REWRITE",
      "CLARIFY",
      "KEYWORD_ALIGNMENT",
      "CONDENSE",
      "EXPAND",
      "REORDER",
    ];
    for (const type of validTypes) {
      expect(ChangeTypeSchema.parse(type)).toBe(type);
    }
    expect(() => ChangeTypeSchema.parse("DELETE_EVERYTHING")).toThrow();

    const validSections = [
      "summary",
      "experience",
      "projects",
      "skills",
      "education",
      "certifications",
      "achievements",
      "languages",
      "links",
    ];
    for (const section of validSections) {
      expect(ChangeSectionSchema.parse(section)).toBe(section);
    }
    expect(() => ChangeSectionSchema.parse("custom_section")).toThrow();
  });

  it("validates a valid ResumeContentChange", () => {
    const validChange = {
      id: "change_1",
      section: "experience",
      itemId: "exp-1",
      field: "bullets[0]",
      originalValue: "Developed REST APIs using Node.js.",
      proposedValue:
        "Developed backend REST APIs using Node.js and Express.js.",
      changeType: "REWRITE",
      targetRequirementIds: ["req-1"],
      evidenceIds: ["exp-1-b1"],
      rationale: "Aligns terminology with target job requirement.",
      risk: "LOW",
      status: "PENDING",
      factCheckStatus: "SUPPORTED",
      factCheckReasoning: "Express.js exists in candidate resume skills.",
    };

    const parsed = ResumeContentChangeSchema.parse(validChange);
    expect(parsed.id).toBe("change_1");
    expect(parsed.proposedValue).toContain("Express.js");
    expect(parsed.status).toBe("PENDING");
  });

  it("rejects ResumeContentChange with empty evidenceIds", () => {
    const invalidChange = {
      id: "change_2",
      section: "experience",
      itemId: "exp-1",
      field: "bullets[0]",
      originalValue: "Developed REST APIs using Node.js.",
      proposedValue: "Built scalable microservices serving millions of users.",
      changeType: "REWRITE",
      targetRequirementIds: ["req-1"],
      evidenceIds: [], // Empty evidenceIds must fail!
      rationale: "Exaggerated claim without evidence",
      risk: "HIGH",
      status: "BLOCKED",
    };

    expect(() => ResumeContentChangeSchema.parse(invalidChange)).toThrow(
      "Every change must trace back to at least one evidence ID",
    );
  });

  it("validates ContentProposalDataSchema and summary stats", () => {
    const validProposalData = {
      changes: [
        {
          id: "change_1",
          section: "summary",
          field: "summary",
          originalValue: "Software developer with backend experience.",
          proposedValue:
            "Full-stack software developer with backend and ML experience.",
          changeType: "KEYWORD_ALIGNMENT",
          targetRequirementIds: ["req-ml"],
          evidenceIds: ["summary_evidence"],
          rationale: "Highlights existing ML projects.",
          risk: "LOW",
          status: "PENDING",
          factCheckStatus: "SUPPORTED",
        },
      ],
      summaryStats: {
        totalProposed: 1,
        verifiedCount: 1,
        blockedCount: 0,
        uncertainCount: 0,
      },
      generalNotes: "Proposal formulated safely.",
      targetJobTitle: "Software Developer",
      targetCompany: "Tech Corp",
    };

    const parsed = ContentProposalDataSchema.parse(validProposalData);
    expect(parsed.changes.length).toBe(1);
    expect(parsed.summaryStats.verifiedCount).toBe(1);
  });

  it("validates GenerateContentProposalInputSchema with UUIDs", () => {
    const validInput = {
      resumeId: "11111111-1111-4111-8111-111111111111",
      jobId: "22222222-2222-4222-8222-222222222222",
      matchId: "33333333-3333-4333-8333-333333333333",
      strategyId: "44444444-4444-4444-8444-444444444444",
    };

    const parsed = GenerateContentProposalInputSchema.parse(validInput);
    expect(parsed.resumeId).toBe(validInput.resumeId);

    expect(() =>
      GenerateContentProposalInputSchema.parse({
        resumeId: "not-a-uuid",
        jobId: "not-a-uuid",
      }),
    ).toThrow();
  });

  it("validates ApplyContentProposalInputSchema (never accepts proposed text strings)", () => {
    const validInput = {
      selectedChangeIds: ["change_1", "change_2"],
    };

    const parsed = ApplyContentProposalInputSchema.parse(validInput);
    expect(parsed.selectedChangeIds).toEqual(["change_1", "change_2"]);

    // Omitted selectedChangeIds is valid (means apply all approved)
    const emptyInput = {};
    const parsedEmpty = ApplyContentProposalInputSchema.parse(emptyInput);
    expect(parsedEmpty.selectedChangeIds).toBeUndefined();
  });

  it("validates UpdateChangeStatusInputSchema", () => {
    expect(UpdateChangeStatusInputSchema.parse({ status: "APPROVED" })).toEqual(
      { status: "APPROVED" },
    );
    expect(UpdateChangeStatusInputSchema.parse({ status: "REJECTED" })).toEqual(
      { status: "REJECTED" },
    );
    expect(() =>
      UpdateChangeStatusInputSchema.parse({ status: "BLOCKED" }),
    ).toThrow();
  });

  it("validates RegenerateSectionInputSchema", () => {
    const validInput = {
      resumeId: "11111111-1111-4111-8111-111111111111",
      section: "summary",
      field: "summary",
      instruction: "Make it concise",
    };
    const parsed = RegenerateSectionInputSchema.parse(validInput);
    expect(parsed.section).toBe("summary");
    expect(parsed.instruction).toBe("Make it concise");

    expect(() =>
      RegenerateSectionInputSchema.parse({
        resumeId: "not-a-uuid",
        section: "invalid_section",
        field: "summary",
      }),
    ).toThrow();
  });

  it("validates ATSValidationResultSchema and SectionRegenerationResponseSchema", () => {
    const validATSResult = {
      isAtsFriendly: true,
      score: 95,
      checks: [
        {
          name: "Sentence Count",
          passed: true,
          feedback: "Optimal 3 sentences",
        },
        { name: "Keyword Density", passed: true },
      ],
      summary: "ATS-friendly phrasing with strong action verbs",
    };

    const parsedATS = ATSValidationResultSchema.parse(validATSResult);
    expect(parsedATS.isAtsFriendly).toBe(true);
    expect(parsedATS.score).toBe(95);

    const validResponse = {
      proposalId: "prop-123",
      changeId: "change-456",
      originalValue: "Developed REST APIs using Node.js.",
      proposedValue:
        "Developed backend REST APIs using Node.js and Express.js.",
      rationale: "Highlight framework stack",
      evidenceIds: ["exp_1_b1"],
      factCheckStatus: "SUPPORTED",
      status: "PENDING",
      atsChecks: validATSResult,
    };

    const parsedResponse =
      SectionRegenerationResponseSchema.parse(validResponse);
    expect(parsedResponse.changeId).toBe("change-456");
    expect(parsedResponse.atsChecks.score).toBe(95);
    expect(parsedResponse.factGuardScore).toBe(100);
    expect(parsedResponse.claims).toEqual([]);
  });

  it("validates FactualClaimSchema and claim classification", () => {
    const validClaim = {
      claim: "Built REST APIs using Node.js",
      category: "TECHNOLOGY",
      evidenceIds: ["exp_1_b1"],
      factCheckStatus: "SUPPORTED",
      reason: "Evidenced in experience entry 1",
    };

    const parsedClaim = FactualClaimSchema.parse(validClaim);
    expect(parsedClaim.claim).toBe("Built REST APIs using Node.js");
    expect(parsedClaim.factCheckStatus).toBe("SUPPORTED");

    const unsupportedClaim = {
      claim: "Developed Django applications",
      category: "FRAMEWORK",
      evidenceIds: [],
      factCheckStatus: "UNSUPPORTED",
      reason: "Not found in resume",
    };

    const parsedUnsupported = FactualClaimSchema.parse(unsupportedClaim);
    expect(parsedUnsupported.factCheckStatus).toBe("UNSUPPORTED");
  });
});
