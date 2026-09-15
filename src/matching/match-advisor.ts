import {
  MatchStrength,
  MatchGap,
  MatchRecommendation,
  MatchedSkillItem,
  JobAnalysis,
  ResumeData,
} from "@resumeai/shared";
import { ExperienceMatchResult } from "./experience-matcher.js";
import { EducationMatchResult } from "./education-matcher.js";
import { KeywordMatchResult } from "./keyword-matcher.js";

export function generateMatchAdvice(params: {
  jobAnalysis: JobAnalysis;
  resumeData: ResumeData;
  matchedSkills: MatchedSkillItem[];
  missingSkills: MatchedSkillItem[];
  partialSkills: MatchedSkillItem[];
  experienceResult: ExperienceMatchResult;
  educationResult: EducationMatchResult;
  keywordResult: KeywordMatchResult;
}): {
  strengths: MatchStrength[];
  gaps: MatchGap[];
  recommendations: MatchRecommendation[];
} {
  const {
    jobAnalysis,
    matchedSkills,
    missingSkills,
    partialSkills,
    experienceResult,
    educationResult,
    keywordResult,
  } = params;

  const strengths: MatchStrength[] = [];
  const gaps: MatchGap[] = [];
  const recommendations: MatchRecommendation[] = [];

  // 1. Strengths from matched required skills
  const strongSkills = matchedSkills.filter((s) => s.importance === "REQUIRED");
  if (strongSkills.length > 0) {
    const skillNames = strongSkills
      .slice(0, 4)
      .map((s) => s.skill)
      .join(", ");
    strengths.push({
      title: "Direct Required Technical Skills",
      detail: `Strong alignment on key required competencies: ${skillNames}.`,
      evidence: strongSkills.flatMap((s) => s.resumeEvidence).slice(0, 3),
      category: "TECHNICAL",
    });
  }

  // 2. Strengths from experience
  if (experienceResult.score >= 90) {
    strengths.push({
      title: "Strong Professional Tenure",
      detail: experienceResult.details,
      evidence: [
        `Demonstrates ${experienceResult.candidateYears} years of cumulative experience`,
      ],
      category: "EXPERIENCE",
    });
  }

  // 3. Strengths from education
  if (educationResult.score >= 90) {
    strengths.push({
      title: "Education Alignment",
      detail: educationResult.details,
      evidence: [],
      category: "EDUCATION",
    });
  }

  // 4. Strengths from keyword coverage
  if (keywordResult.score >= 70) {
    strengths.push({
      title: "High ATS Keyword Coverage",
      detail: `Resume contains ${keywordResult.matchedCount} of ${keywordResult.totalCount} extracted industry keywords (${keywordResult.score}%).`,
      evidence: keywordResult.matchedKeywords.slice(0, 5),
      category: "KEYWORDS",
    });
  }

  // 5. Gaps — Prioritize MISSING REQUIRED SKILLS
  const missingRequired = missingSkills.filter(
    (s) => s.importance === "REQUIRED",
  );
  for (const s of missingRequired) {
    gaps.push({
      title: `Required Skill: ${s.skill}`,
      detail: `${s.skill} is specified as a required qualification, but was not found in the resume.`,
      importance: "REQUIRED",
      missingType: "SKILL",
      critical: true,
      remedyHint: `Review whether you have experience with ${s.skill} that could be explicitly documented in your experience or projects.`,
    });
  }

  // 6. Gaps — Missing Experience
  if (experienceResult.score < 80 && experienceResult.requiredYears > 0) {
    gaps.push({
      title: "Tenure Gap",
      detail: `Job requires ${experienceResult.requiredYears}+ years of experience, but resume demonstrates approximately ${experienceResult.candidateYears} years.`,
      importance: "REQUIRED",
      missingType: "EXPERIENCE",
      critical: true,
      remedyHint:
        "Ensure all relevant past employment and freelance history dates are fully documented.",
    });
  }

  // 7. Gaps — MISSING PREFERRED SKILLS (excluding negated items)
  const missingPreferred = missingSkills.filter(
    (s) =>
      s.importance !== "REQUIRED" &&
      !/\b(?:not\s+required|no\b.*\brequired|not\s+needed)\b/i.test(
        s.jobEvidence || "",
      ),
  );
  for (const s of missingPreferred.slice(0, 4)) {
    gaps.push({
      title: `Preferred Skill: ${s.skill}`,
      detail: `${s.skill} is listed as a preferred qualification, but was not found in the resume.`,
      importance: "PREFERRED",
      missingType: "SKILL",
      critical: false,
      remedyHint: `If you possess familiarity with ${s.skill}, consider highlighting it as a secondary skill.`,
    });
  }

  // 8. Actionable Analytical Recommendations
  if (missingRequired.length > 0) {
    const topMissing = missingRequired
      .slice(0, 3)
      .map((s) => s.skill)
      .join(", ");
    recommendations.push({
      title: "Address Critical Skill Gaps",
      description: `The job description explicitly requires ${topMissing}. If you have background in these areas, consider adding direct evidence to your bullet points.`,
      priority: "HIGH",
      actionable: true,
    });
  }

  if (keywordResult.score < 60) {
    const missingSample = keywordResult.missingKeywords.slice(0, 4).join(", ");
    recommendations.push({
      title: "Increase Keyword Alignment",
      description: `Consider naturally incorporating missing domain terminology (e.g. ${missingSample}) into your summary and project descriptions where applicable.`,
      priority: "MEDIUM",
      actionable: true,
    });
  }

  if (partialSkills.length > 0) {
    const partialNames = partialSkills
      .slice(0, 3)
      .map((s) => s.skill)
      .join(", ");
    recommendations.push({
      title: "Strengthen Context for Partially Matched Skills",
      description: `Skills such as ${partialNames} are mentioned contextually. Adding specific accomplishments or metrics will demonstrate deeper mastery.`,
      priority: "MEDIUM",
      actionable: true,
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      title: "Maintain Strong Positioning",
      description:
        "Your resume exhibits solid overall alignment with this position. Focus on highlighting quantifiable achievements in your interview preparation.",
      priority: "LOW",
      actionable: false,
    });
  }

  return { strengths, gaps, recommendations };
}
