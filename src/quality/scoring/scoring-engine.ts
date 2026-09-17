import {
  ResumeQualityCategory,
  ResumeQualityCategoryType,
  RESUME_QUALITY_WEIGHTS,
  ResumeQualityFinding,
  CategoryScore,
  QualityStatusLabel,
  CATEGORY_DISPLAY_NAMES,
} from "@resumeai/shared";
import { AllChecksResult } from "../types.js";

// Calibrated penalty deductions by severity (Conservative & Explainable)
export const SEVERITY_PENALTIES: Record<string, number> = {
  CRITICAL: 25,
  HIGH: 15,
  MEDIUM: 8,
  LOW: 3,
  INFO: 0,
};

export interface CategoryContribution {
  category: ResumeQualityCategoryType;
  displayName: string;
  score: number;
  weight: number;
  contribution: number;
}

export interface ScoringEngineOutput {
  overallScore: number;
  statusLabel: QualityStatusLabel;
  summary: string;
  categoryScores: Record<ResumeQualityCategoryType, CategoryScore>;
  scoringBreakdown: CategoryContribution[];
  strengths: string[];
  criticalIssuesCount: number;
  allFindings: ResumeQualityFinding[];
}

/**
 * Maps a numerical score (0-100) to a standard semantic status label.
 */
export function getStatusLabel(score: number): QualityStatusLabel {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Needs Improvement";
  return "Needs Attention";
}

/**
 * Deterministic Resume Quality Scoring Engine.
 * Evaluates category scores, enforces documented safety caps, and computes final weighted score.
 * Formula:
 * categoryScore = max(0, 100 - sum(deductions))
 * weightedContribution = categoryScore * weight
 * overallScore = round(sum(weightedContributions))
 * Never relies on LLM random values.
 */
export function calculateQualityScore(
  checksResult: AllChecksResult,
  additionalFindings: ResumeQualityFinding[] = [],
): ScoringEngineOutput {
  const combinedFindings = [...checksResult.findings, ...additionalFindings];

  // Group findings by category
  const findingsByCategory: Record<ResumeQualityCategoryType, ResumeQualityFinding[]> = {
    ATS_STRUCTURE: [],
    CONTENT_QUALITY: [],
    EXPERIENCE_QUALITY: [],
    SKILLS_KEYWORDS: [],
    EDUCATION_CERTIFICATIONS: [],
    CONTACT_LINKS: [],
    FORMATTING_PARSEABILITY: [],
    CONSISTENCY: [],
  };

  combinedFindings.forEach((finding) => {
    if (findingsByCategory[finding.category]) {
      findingsByCategory[finding.category].push(finding);
    }
  });

  const categoryScores: Partial<Record<ResumeQualityCategoryType, CategoryScore>> = {};
  const scoringBreakdown: CategoryContribution[] = [];
  let criticalIssuesCount = 0;

  // 1. Calculate each category score
  for (const catKey of Object.keys(ResumeQualityCategory) as ResumeQualityCategoryType[]) {
    const findings = findingsByCategory[catKey] || [];
    const weight = RESUME_QUALITY_WEIGHTS[catKey] ?? 0;
    const displayName = CATEGORY_DISPLAY_NAMES[catKey] || catKey;

    let deductions = 0;
    findings.forEach((f) => {
      const penalty = SEVERITY_PENALTIES[f.severity] ?? 3;
      deductions += penalty;
      if (f.severity === "CRITICAL") criticalIssuesCount++;
    });

    let rawScore = Math.max(0, Math.min(100, 100 - deductions));

    // Category-specific safety caps (Documented Rules):
    // Rule 1: Missing essential contact (name or email) caps contact at 40
    if (catKey === "CONTACT_LINKS") {
      const missingName = findings.some((f) => f.id === "contact-missing-name");
      const invalidOrMissingEmail = findings.some(
        (f) => f.id === "contact-missing-email" || f.id === "contact-invalid-email",
      );
      if (missingName || invalidOrMissingEmail) {
        rawScore = Math.min(rawScore, 40);
      }
    }

    // Rule 2: Complete absence of experience entries caps Experience Quality at 20
    if (catKey === "EXPERIENCE_QUALITY") {
      const hasNoExp = findings.some((f) => f.id === "exp-none");
      if (hasNoExp && checksResult.summaryMetrics.experienceCount === 0) {
        rawScore = Math.min(rawScore, 20);
      }
    }

    // Rule 3: Missing 2+ core sections caps ATS Structure at 50
    if (catKey === "ATS_STRUCTURE") {
      const missingExp = findings.some((f) => f.id === "struct-missing-experience");
      const missingEdu = findings.some((f) => f.id === "struct-missing-education");
      const missingPersonal = findings.some((f) => f.id === "struct-missing-personal-info");
      const missingCount = [missingExp, missingEdu, missingPersonal].filter(Boolean).length;
      if (missingCount >= 2) {
        rawScore = Math.min(rawScore, 50);
      }
    }

    const roundedScore = Math.round(rawScore);
    const recommendations = findings
      .map((f) => f.recommendation)
      .filter(Boolean)
      .slice(0, 4);

    categoryScores[catKey] = {
      category: catKey,
      name: displayName,
      score: roundedScore,
      maxScore: 100,
      weight,
      status: getStatusLabel(roundedScore),
      findings,
      recommendations,
    };

    const contribution = Number((roundedScore * weight).toFixed(2));
    scoringBreakdown.push({
      category: catKey,
      displayName,
      score: roundedScore,
      weight,
      contribution,
    });
  }

  // 2. Compute Weighted Final Score
  // Sum category contributions: round only at final stage
  let weightedSum = 0;
  for (const catKey of Object.keys(categoryScores) as ResumeQualityCategoryType[]) {
    const cat = categoryScores[catKey]!;
    weightedSum += cat.score * cat.weight;
  }

  let finalScore = Math.round(weightedSum);

  // Global Safety Caps (Documented Rules):
  // Rule A: Missing essential contact (name or email) caps overall score at 75
  const hasCriticalContactIssue =
    (categoryScores.CONTACT_LINKS?.score ?? 100) <= 40 ||
    !checksResult.summaryMetrics.hasValidEmail;
  if (hasCriticalContactIssue) {
    finalScore = Math.min(finalScore, 75);
  }

  // Rule B: Missing 2+ core sections caps overall score at 70
  if ((categoryScores.ATS_STRUCTURE?.score ?? 100) <= 50) {
    finalScore = Math.min(finalScore, 70);
  }

  finalScore = Math.max(0, Math.min(100, finalScore));
  const overallStatus = getStatusLabel(finalScore);

  // 3. Compile Positive Strengths
  const strengths: string[] = [];
  if (checksResult.summaryMetrics.hasContactInfo && (categoryScores.CONTACT_LINKS?.score ?? 0) >= 90) {
    strengths.push("Complete and accessible contact information");
  }
  if ((categoryScores.ATS_STRUCTURE?.score ?? 0) >= 90) {
    strengths.push("Well-structured standard section headings");
  }
  if (checksResult.summaryMetrics.actionVerbBulletsCount >= 3) {
    strengths.push("Strong action-oriented language across achievements");
  }
  if (checksResult.summaryMetrics.quantifiedBulletsCount >= 2) {
    strengths.push("Measurable outcomes and metrics present in experience");
  }
  if (checksResult.summaryMetrics.skillsCount >= 6 && (categoryScores.SKILLS_KEYWORDS?.score ?? 0) >= 85) {
    strengths.push("Comprehensive technical skills categorization");
  }
  if ((categoryScores.CONSISTENCY?.score ?? 0) >= 90) {
    strengths.push("Consistent date formatting and timeline chronology");
  }
  if ((categoryScores.FORMATTING_PARSEABILITY?.score ?? 0) >= 90) {
    strengths.push("Clean text formatting without parsing-risk unicode or emojis");
  }

  // Fallback strengths
  if (strengths.length === 0) {
    strengths.push("Foundational resume components present and identifiable");
  }

  // Summary message
  let summary = "";
  if (finalScore >= 90) {
    summary = "Excellent resume quality with strong ATS readiness and clear accomplishments.";
  } else if (finalScore >= 75) {
    summary = "Solid foundation with good structure; addressing targeted recommendations will further strengthen ATS readability.";
  } else if (finalScore >= 60) {
    summary = "Needs improvement in structure or detail to ensure seamless ATS parseability and recruiter impact.";
  } else {
    summary = "Needs attention: critical sections or essential details are missing or need substantial enhancement.";
  }

  return {
    overallScore: finalScore,
    statusLabel: overallStatus,
    summary,
    categoryScores: categoryScores as Record<ResumeQualityCategoryType, CategoryScore>,
    scoringBreakdown,
    strengths: strengths.slice(0, 5),
    criticalIssuesCount,
    allFindings: combinedFindings,
  };
}
