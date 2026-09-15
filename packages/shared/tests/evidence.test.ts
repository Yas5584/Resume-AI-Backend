import { describe, it, expect } from "vitest";
import {
  ClaimEvidenceSchema,
  FactCheckResultSchema,
} from "../src/schemas/evidence.schema.js";
import { VerificationStatus } from "../src/constants/index.js";

describe("Shared Factual Accuracy Evidence Model", () => {
  it("should validate complete ClaimEvidence with verified sources", () => {
    const claim = {
      id: "claim-1",
      claimText: "Led migration to PostgreSQL 18",
      claimCategory: "TECHNOLOGY_OR_TOOL" as const,
      targetSection: "Experience: Tech Lead",
      status: VerificationStatus.SUPPORTED,
      sources: [
        {
          sourceType: "ORIGINAL_RESUME" as const,
          sourceIdentifier: "resume_original.pdf",
          rawSnippet: "Migrated database to PostgreSQL 18",
          confidenceScore: 0.99,
        },
      ],
      verificationNotes: "Source directly matches claim",
    };

    // Category should be one of the enum values, let's use TOOL_OR_TECHNOLOGY
    const validClaim = {
      ...claim,
      claimCategory: "TOOL_OR_TECHNOLOGY" as const,
    };

    const result = ClaimEvidenceSchema.safeParse(validClaim);
    expect(result.success).toBe(true);
  });

  it("should validate FactCheckResult summary schema", () => {
    const summary = {
      verified: true,
      claims: [],
      totalClaimsCount: 0,
      supportedCount: 0,
      unsupportedCount: 0,
      contradictedCount: 0,
      uncertainCount: 0,
      summary: "No claims analyzed",
    };

    const result = FactCheckResultSchema.safeParse(summary);
    expect(result.success).toBe(true);
  });
});
