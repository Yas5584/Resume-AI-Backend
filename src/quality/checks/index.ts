import { ResumeData, TemplateConfig, ResumeQualityFinding } from "@resumeai/shared";
import { AllChecksResult, DeterministicCheckResult } from "../types.js";
import { checkATSStructure } from "./ats-structure.check.js";
import { checkContactAndLinks } from "./contact-links.check.js";
import { checkExperienceAndContent } from "./experience.check.js";
import { checkSkills } from "./skills.check.js";
import { checkEducationAndCertifications } from "./education.check.js";
import { checkFormattingAndParseability } from "./formatting.check.js";
import { checkConsistencyAndDuplication } from "./consistency.check.js";

export * from "./ats-structure.check.js";
export * from "./contact-links.check.js";
export * from "./experience.check.js";
export * from "./skills.check.js";
export * from "./education.check.js";
export * from "./formatting.check.js";
export * from "./consistency.check.js";

/**
 * Runs all deterministic checks on a structured resume.
 * Executes purely in backend logic without LLM calls.
 */
export function runAllDeterministicChecks(
  data: ResumeData,
  config?: TemplateConfig | null,
): AllChecksResult {
  const atsStructResult = checkATSStructure(data);
  const contactResult = checkContactAndLinks(data);
  const { experienceResult, contentResult, metrics: expMetrics } =
    checkExperienceAndContent(data);
  const skillsResult = checkSkills(data);
  const educationResult = checkEducationAndCertifications(data);
  const { result: formatResult, totalWords } = checkFormattingAndParseability(
    data,
    config,
  );
  const consistencyResult = checkConsistencyAndDuplication(data);

  const categoryResults: Record<string, DeterministicCheckResult> = {
    ATS_STRUCTURE: atsStructResult,
    CONTACT_LINKS: contactResult,
    EXPERIENCE_QUALITY: experienceResult,
    CONTENT_QUALITY: contentResult,
    SKILLS_KEYWORDS: skillsResult,
    EDUCATION_CERTIFICATIONS: educationResult,
    FORMATTING_PARSEABILITY: formatResult,
    CONSISTENCY: consistencyResult,
  };

  const allFindings: ResumeQualityFinding[] = [
    ...atsStructResult.findings,
    ...contentResult.findings,
    ...experienceResult.findings,
    ...skillsResult.findings,
    ...educationResult.findings,
    ...contactResult.findings,
    ...formatResult.findings,
    ...consistencyResult.findings,
  ];

  return {
    findings: allFindings,
    categoryResults,
    summaryMetrics: {
      totalWords,
      experienceCount: expMetrics.experienceCount,
      bulletCount: expMetrics.bulletCount,
      quantifiedBulletsCount: expMetrics.quantifiedBulletsCount,
      actionVerbBulletsCount: expMetrics.actionVerbBulletsCount,
      skillsCount: (skillsResult.metrics.totalSkillsCount as number) || 0,
      educationCount: (educationResult.metrics.educationCount as number) || 0,
      hasContactInfo: !!(data.personalInfo?.fullName && data.personalInfo?.email),
      hasValidEmail: !!contactResult.metrics.hasValidEmail,
      hasValidPhone: !!contactResult.metrics.hasValidPhone,
      hasLocation: !!contactResult.metrics.hasLocation,
    },
  };
}
