import {
  ResumeData,
  JobAnalysis,
  MatchAnalysis,
  MATCH_SCORE_VERSION,
  DEFAULT_MATCH_SCORE_WEIGHTS,
  getMatchScoreLabel,
} from "@resumeai/shared";
import { matchSkills } from "./skill-matcher.js";
import { matchExperience } from "./experience-matcher.js";
import { matchEducation } from "./education-matcher.js";
import { matchCertifications } from "./certification-matcher.js";
import { matchResponsibilities } from "./responsibility-matcher.js";
import { matchKeywords } from "./keyword-matcher.js";
import { generateMatchAdvice } from "./match-advisor.js";

export interface MatchingOptions {
  resumeUpdatedAt?: Date | string | null;
  jobUpdatedAt?: Date | string | null;
}

/**
 * Deterministic Matching Engine
 *
 * Computes a transparent, reproducible MatchAnalysis object.
 * Final numeric score is calculated 100% deterministically by code.
 */
export function calculateMatchAnalysis(
  jobAnalysis: JobAnalysis,
  resumeData: ResumeData,
  options: MatchingOptions = {},
): MatchAnalysis {
  // 1. Execute individual component matchers
  const skillResult = matchSkills(jobAnalysis, resumeData);
  const experienceResult = matchExperience(jobAnalysis, resumeData);
  const educationResult = matchEducation(
    jobAnalysis,
    resumeData,
    experienceResult.candidateYears,
  );
  const certificationResult = matchCertifications(jobAnalysis, resumeData);
  const responsibilityResult = matchResponsibilities(jobAnalysis, resumeData);
  const keywordResult = matchKeywords(jobAnalysis, resumeData);

  // 2. Weighted component scoring
  const weights = DEFAULT_MATCH_SCORE_WEIGHTS;

  const requiredWeighted =
    Math.round(
      ((skillResult.requiredScore * weights.requiredRequirements) / 100) * 100,
    ) / 100;
  const preferredWeighted =
    Math.round(
      ((skillResult.preferredScore * weights.preferredSkills) / 100) * 100,
    ) / 100;
  const experienceWeighted =
    Math.round(((experienceResult.score * weights.experience) / 100) * 100) /
    100;
  const responsibilityWeighted =
    Math.round(
      ((responsibilityResult.score * weights.responsibilities) / 100) * 100,
    ) / 100;
  const keywordWeighted =
    Math.round(((keywordResult.score * weights.keywords) / 100) * 100) / 100;
  const educationWeighted =
    Math.round(((educationResult.score * weights.education) / 100) * 100) / 100;
  const certificationWeighted =
    Math.round(
      ((certificationResult.score * weights.certifications) / 100) * 100,
    ) / 100;

  // 3. Compute overall score
  const rawOverall =
    requiredWeighted +
    preferredWeighted +
    experienceWeighted +
    responsibilityWeighted +
    keywordWeighted +
    educationWeighted +
    certificationWeighted;

  const overallScore = Math.min(100, Math.max(0, Math.round(rawOverall)));
  const scoreLabel = getMatchScoreLabel(overallScore);

  // 4. Generate structured advice, strengths, and gaps
  const { strengths, gaps, recommendations } = generateMatchAdvice({
    jobAnalysis,
    resumeData,
    matchedSkills: skillResult.matchedSkills,
    missingSkills: skillResult.missingSkills,
    partialSkills: skillResult.partialSkills,
    experienceResult,
    educationResult,
    keywordResult,
  });

  // 5. Assemble and return full MatchAnalysis
  return {
    scoreVersion: MATCH_SCORE_VERSION,
    overallScore,
    scoreLabel,

    requiredRequirementsMatch: {
      score: skillResult.requiredScore,
      weight: weights.requiredRequirements,
      weightedScore: requiredWeighted,
      matchedCount: skillResult.requiredMatchedCount,
      totalCount: skillResult.requiredTotalCount,
      details: `Matched ${skillResult.requiredMatchedCount} of ${skillResult.requiredTotalCount} required skills`,
    },

    preferredSkillsMatch: {
      score: skillResult.preferredScore,
      weight: weights.preferredSkills,
      weightedScore: preferredWeighted,
      matchedCount: skillResult.preferredMatchedCount,
      totalCount: skillResult.preferredTotalCount,
      details: `Matched ${skillResult.preferredMatchedCount} of ${skillResult.preferredTotalCount} preferred skills`,
    },

    skillMatch: {
      score: skillResult.score,
      weight: weights.skills,
      weightedScore:
        Math.round((requiredWeighted + preferredWeighted) * 100) / 100,
      matchedCount: skillResult.matchedCount,
      totalCount: skillResult.totalCount,
      details: `Matched ${skillResult.matchedCount} of ${skillResult.totalCount} technical skills`,
    },

    experienceMatch: {
      score: experienceResult.score,
      weight: weights.experience,
      weightedScore: experienceWeighted,
      matchedCount: experienceResult.matchedCount,
      totalCount: experienceResult.totalCount,
      details: experienceResult.details,
    },

    responsibilityAlignment: {
      score: responsibilityResult.score,
      weight: weights.responsibilities,
      weightedScore: responsibilityWeighted,
      matchedCount: responsibilityResult.matchedCount,
      totalCount: responsibilityResult.totalCount,
      details: responsibilityResult.details,
    },

    keywordCoverage: {
      score: keywordResult.score,
      weight: weights.keywords,
      weightedScore: keywordWeighted,
      matchedCount: keywordResult.matchedCount,
      totalCount: keywordResult.totalCount,
      details: keywordResult.details,
    },

    educationMatch: {
      score: educationResult.score,
      weight: weights.education,
      weightedScore: educationWeighted,
      matchedCount: educationResult.matchedCount,
      totalCount: educationResult.totalCount,
      details: educationResult.details,
    },

    certificationMatch: {
      score: certificationResult.score,
      weight: weights.certifications,
      weightedScore: certificationWeighted,
      matchedCount: certificationResult.matchedCount,
      totalCount: certificationResult.totalCount,
      details: certificationResult.details,
    },

    matchedSkills: skillResult.matchedSkills,
    missingSkills: skillResult.missingSkills,
    partialSkills: skillResult.partialSkills,

    matchedRequirements: responsibilityResult.matchedItems,
    missingRequirements: responsibilityResult.missingItems,

    strengths,
    gaps,
    recommendations,

    resumeUpdatedAt: options.resumeUpdatedAt
      ? new Date(options.resumeUpdatedAt).toISOString()
      : null,
    jobUpdatedAt: options.jobUpdatedAt
      ? new Date(options.jobUpdatedAt).toISOString()
      : null,
    isStale: false,

    // Backward compatibility aliases
    hardSkillsMatchScore: skillResult.score,
    experienceMatchScore: experienceResult.score,
    tailoringRecommendations: recommendations.map((r) => r.description),
  };
}
