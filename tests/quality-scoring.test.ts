import { describe, it, expect } from "vitest";
import {
  RESUME_QUALITY_WEIGHTS,
  ResumeQualityCategory,
  FindingSeverity,
  ResumeQualityCategoryType,
} from "@resumeai/shared";
import {
  calculateQualityScore,
  getStatusLabel,
  SEVERITY_PENALTIES,
} from "../src/quality/scoring/scoring-engine.js";
import { AllChecksResult, DeterministicCheckResult } from "../src/quality/types.js";

function createMockChecksResult(
  overrides?: Partial<AllChecksResult>,
): AllChecksResult {
  const defaultCategoryResult = (
    cat: ResumeQualityCategoryType,
  ): DeterministicCheckResult => ({
    category: cat,
    findings: [],
    passedChecksCount: 5,
    totalChecksCount: 5,
    metrics: {},
  });

  return {
    findings: [],
    categoryResults: {
      ATS_STRUCTURE: defaultCategoryResult("ATS_STRUCTURE"),
      CONTENT_QUALITY: defaultCategoryResult("CONTENT_QUALITY"),
      EXPERIENCE_QUALITY: defaultCategoryResult("EXPERIENCE_QUALITY"),
      SKILLS_KEYWORDS: defaultCategoryResult("SKILLS_KEYWORDS"),
      EDUCATION_CERTIFICATIONS: defaultCategoryResult("EDUCATION_CERTIFICATIONS"),
      CONTACT_LINKS: defaultCategoryResult("CONTACT_LINKS"),
      FORMATTING_PARSEABILITY: defaultCategoryResult("FORMATTING_PARSEABILITY"),
      CONSISTENCY: defaultCategoryResult("CONSISTENCY"),
    },
    summaryMetrics: {
      totalWords: 350,
      experienceCount: 2,
      bulletCount: 6,
      quantifiedBulletsCount: 3,
      actionVerbBulletsCount: 5,
      skillsCount: 10,
      educationCount: 1,
      hasContactInfo: true,
      hasValidEmail: true,
      hasValidPhone: true,
      hasLocation: true,
    },
    ...overrides,
  };
}

describe("Resume Quality Scoring Engine (Phase 10 Accuracy)", () => {
  it("verifies category weights sum to exactly 1.00", () => {
    const totalWeight = Object.values(RESUME_QUALITY_WEIGHTS).reduce(
      (sum, w) => sum + w,
      0,
    );
    expect(Number(totalWeight.toFixed(4))).toBe(1.0);
  });

  it("verifies calibrated severity penalties match documented values", () => {
    expect(SEVERITY_PENALTIES.CRITICAL).toBe(25);
    expect(SEVERITY_PENALTIES.HIGH).toBe(15);
    expect(SEVERITY_PENALTIES.MEDIUM).toBe(8);
    expect(SEVERITY_PENALTIES.LOW).toBe(3);
    expect(SEVERITY_PENALTIES.INFO).toBe(0);
  });

  it("assigns correct status labels across score thresholds", () => {
    expect(getStatusLabel(100)).toBe("Excellent");
    expect(getStatusLabel(90)).toBe("Excellent");
    expect(getStatusLabel(89)).toBe("Good");
    expect(getStatusLabel(75)).toBe("Good");
    expect(getStatusLabel(74)).toBe("Needs Improvement");
    expect(getStatusLabel(60)).toBe("Needs Improvement");
    expect(getStatusLabel(59)).toBe("Needs Attention");
    expect(getStatusLabel(0)).toBe("Needs Attention");
  });

  it("calculates perfect 100 score when there are zero findings", () => {
    const cleanChecks = createMockChecksResult();
    const result = calculateQualityScore(cleanChecks, []);

    expect(result.overallScore).toBe(100);
    expect(result.statusLabel).toBe("Excellent");
    expect(result.criticalIssuesCount).toBe(0);
    expect(result.allFindings).toHaveLength(0);

    for (const cat of Object.values(result.categoryScores)) {
      expect(cat.score).toBe(100);
      expect(cat.status).toBe("Excellent");
    }
  });

  it("prints/debugs exact score calculation and verifies mathematical consistency (Requirement 11)", () => {
    const mockChecks = createMockChecksResult({
      findings: [
        {
          id: "struct-missing-education",
          category: ResumeQualityCategory.ATS_STRUCTURE,
          severity: FindingSeverity.HIGH, // -15 deduction -> 85
          title: "Missing Education Section",
          description: "No education credentials listed",
          recommendation: "Add education history",
        },
        {
          id: "content-weak-action-verb-1",
          category: ResumeQualityCategory.CONTENT_QUALITY,
          severity: FindingSeverity.MEDIUM, // -8 deduction -> 92
          title: "Weak action verb detected",
          description: "Bullet uses worked on",
          recommendation: "Replace with active verb",
        },
        {
          id: "skills-tech-project-only-django",
          category: ResumeQualityCategory.SKILLS_KEYWORDS,
          severity: FindingSeverity.INFO, // 0 deduction -> 100
          title: "Technology appears in project experience but is not listed in Skills.",
          description: "Django in project",
          recommendation: "Consider adding to Skills",
        },
        {
          id: "contact-missing-phone",
          category: ResumeQualityCategory.CONTACT_LINKS,
          severity: FindingSeverity.MEDIUM, // -8 deduction -> 92
          title: "Missing phone number",
          description: "No phone number",
          recommendation: "Add phone number",
        },
        {
          id: "contact-missing-linkedin",
          category: ResumeQualityCategory.CONTACT_LINKS,
          severity: FindingSeverity.MEDIUM, // -8 deduction -> 84 (100 - 16 = 84)
          title: "LinkedIn profile not linked",
          description: "No LinkedIn URL",
          recommendation: "Add LinkedIn URL",
        },
      ],
    });

    const result = calculateQualityScore(mockChecks, []);

    // Print / Debug exact score calculation
    console.log("\n--- EXACT QUALITY SCORE BREAKDOWN ---");
    let calculatedSum = 0;
    result.scoringBreakdown.forEach((item) => {
      const line = `${item.displayName}: ${item.score} × ${item.weight.toFixed(2)} = ${item.contribution.toFixed(2)}`;
      console.log(line);
      calculatedSum += item.score * item.weight;
    });
    console.log(`Sum of contributions: ${calculatedSum.toFixed(2)}`);
    console.log(`Final Rounded Score: ${result.overallScore}`);
    console.log(`Critical Issues Count: ${result.criticalIssuesCount}`);
    console.log("------------------------------------\n");

    // Check specific categories
    // ATS_STRUCTURE: 100 - 15 = 85
    expect(result.categoryScores[ResumeQualityCategory.ATS_STRUCTURE].score).toBe(85);
    // CONTENT_QUALITY: 100 - 8 = 92
    expect(result.categoryScores[ResumeQualityCategory.CONTENT_QUALITY].score).toBe(92);
    // SKILLS_KEYWORDS: 100 - 0 = 100 (INFO findings do not deduct)
    expect(result.categoryScores[ResumeQualityCategory.SKILLS_KEYWORDS].score).toBe(100);
    // CONTACT_LINKS: 100 - 16 = 84
    expect(result.categoryScores[ResumeQualityCategory.CONTACT_LINKS].score).toBe(84);

    // Sum must equal final score (within rounding)
    expect(result.overallScore).toBe(Math.round(calculatedSum));
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);

    // Missing phone is MEDIUM, NOT CRITICAL -> criticalIssuesCount must be 0!
    expect(result.criticalIssuesCount).toBe(0);
  });

  it("enforces category safety cap when contact email is missing", () => {
    const missingContactChecks = createMockChecksResult({
      findings: [
        {
          id: "contact-missing-email",
          category: ResumeQualityCategory.CONTACT_LINKS,
          severity: FindingSeverity.CRITICAL,
          title: "Missing Email",
          description: "No valid email was provided",
          recommendation: "Provide a contact email",
        },
      ],
      summaryMetrics: {
        totalWords: 350,
        experienceCount: 2,
        bulletCount: 6,
        quantifiedBulletsCount: 3,
        actionVerbBulletsCount: 5,
        skillsCount: 10,
        educationCount: 1,
        hasContactInfo: false,
        hasValidEmail: false,
        hasValidPhone: true,
        hasLocation: true,
      },
    });

    const result = calculateQualityScore(missingContactChecks, []);
    // Category score capped at 40 max
    expect(
      result.categoryScores[ResumeQualityCategory.CONTACT_LINKS].score,
    ).toBeLessThanOrEqual(40);
    // Overall score capped at 75 max
    expect(result.overallScore).toBeLessThanOrEqual(75);
    expect(result.criticalIssuesCount).toBe(1);
  });

  it("enforces experience category cap when experience is completely empty", () => {
    const emptyExperienceChecks = createMockChecksResult({
      findings: [
        {
          id: "exp-none",
          category: ResumeQualityCategory.EXPERIENCE_QUALITY,
          severity: FindingSeverity.CRITICAL,
          title: "No Experience",
          description: "No work history found",
          recommendation: "Add experience entries",
        },
      ],
      summaryMetrics: {
        totalWords: 50,
        experienceCount: 0,
        bulletCount: 0,
        quantifiedBulletsCount: 0,
        actionVerbBulletsCount: 0,
        skillsCount: 5,
        educationCount: 1,
        hasContactInfo: true,
        hasValidEmail: true,
        hasValidPhone: true,
        hasLocation: true,
      },
    });

    const result = calculateQualityScore(emptyExperienceChecks, []);
    // Experience quality capped at 20 max
    expect(
      result.categoryScores[ResumeQualityCategory.EXPERIENCE_QUALITY].score,
    ).toBeLessThanOrEqual(20);
  });

  it("guarantees score reproducibility on repeated evaluations", () => {
    const checks = createMockChecksResult({
      findings: [
        {
          id: "f-1",
          category: ResumeQualityCategory.CONTENT_QUALITY,
          severity: FindingSeverity.MEDIUM,
          title: "Weak phrasing",
          description: "Needs active verbs",
          recommendation: "Use strong verbs",
        },
      ],
    });

    const scoreA = calculateQualityScore(checks, []);
    const scoreB = calculateQualityScore(checks, []);
    expect(scoreA.overallScore).toBe(scoreB.overallScore);
    expect(scoreA.criticalIssuesCount).toBe(scoreB.criticalIssuesCount);
    expect(JSON.stringify(scoreA.categoryScores)).toBe(JSON.stringify(scoreB.categoryScores));
  });
});
