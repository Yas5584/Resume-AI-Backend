import {
  ResumeData,
  ResumeQualityFinding,
  ResumeQualityCategory,
  FindingSeverity,
} from "@resumeai/shared";
import { DeterministicCheckResult } from "../types.js";

// Standard canonical aliases
export const SECTION_ALIASES: Record<string, string[]> = {
  experience: [
    "experience",
    "work experience",
    "professional experience",
    "employment history",
    "work history",
  ],
  education: [
    "education",
    "academic background",
    "academic history",
    "qualifications",
  ],
  skills: [
    "skills",
    "technical skills",
    "core competencies",
    "competencies",
    "technologies",
  ],
  projects: [
    "projects",
    "personal projects",
    "key projects",
    "technical projects",
  ],
  summary: [
    "summary",
    "professional summary",
    "profile",
    "executive summary",
    "about me",
  ],
  certifications: [
    "certifications",
    "licenses",
    "credentials",
    "certificates",
  ],
  achievements: [
    "achievements",
    "honors",
    "awards",
    "honors & awards",
  ],
};

/**
 * Evaluates standard ATS section structure, critical section presence, order, and fragmentation.
 */
export function checkATSStructure(data: ResumeData): DeterministicCheckResult {
  const findings: ResumeQualityFinding[] = [];
  let passed = 0;
  let total = 0;

  // 1. Critical Sections Presence
  total++;
  const hasExperience = Array.isArray(data.experience) && data.experience.length > 0;
  const hasEducation = Array.isArray(data.education) && data.education.length > 0;
  const hasSkills = Array.isArray(data.skills) && data.skills.length > 0;
  const hasPersonalInfo = !!data.personalInfo && !!data.personalInfo.fullName;

  if (hasExperience) {
    passed++;
  } else {
    findings.push({
      id: "struct-missing-experience",
      category: ResumeQualityCategory.ATS_STRUCTURE,
      severity: FindingSeverity.CRITICAL,
      title: "Missing Work Experience section",
      description: "No work experience entries were found in the resume.",
      whyItMatters:
        "Applicant Tracking Systems and recruiters expect a clear chronological work experience history.",
      recommendation:
        "Add your professional work history with titles, employers, dates, and bulleted accomplishments.",
      section: "experience",
    });
  }

  total++;
  if (hasEducation) {
    passed++;
  } else {
    findings.push({
      id: "struct-missing-education",
      category: ResumeQualityCategory.ATS_STRUCTURE,
      severity: FindingSeverity.HIGH,
      title: "Missing Education section",
      description: "No education entries were found.",
      whyItMatters:
        "Many ATS filters and hiring managers require educational credentials to verify minimum qualifications.",
      recommendation:
        "Include your degree, institution, and graduation timeframe in the Education section.",
      section: "education",
    });
  }

  total++;
  if (hasSkills) {
    passed++;
  } else {
    findings.push({
      id: "struct-missing-skills",
      category: ResumeQualityCategory.ATS_STRUCTURE,
      severity: FindingSeverity.HIGH,
      title: "Missing Skills section",
      description: "No organized skills or technical proficiencies listed.",
      whyItMatters:
        "ATS parsers scan dedicated skills sections to match keyword criteria for role qualifications.",
      recommendation:
        "Add a dedicated Skills section categorizing languages, frameworks, tools, and platforms.",
      section: "skills",
    });
  }

  total++;
  if (hasPersonalInfo) {
    passed++;
  } else {
    findings.push({
      id: "struct-missing-personal-info",
      category: ResumeQualityCategory.ATS_STRUCTURE,
      severity: FindingSeverity.CRITICAL,
      title: "Missing Personal Information",
      description: "Candidate name and contact information are not properly populated.",
      whyItMatters:
        "Without identifiable candidate details, an ATS cannot create or link an applicant profile.",
      recommendation:
        "Add your full name, email, phone number, and location to the Personal Info section.",
      section: "personalInfo",
    });
  }

  // 2. Summary Presence (Standard best practice)
  total++;
  const hasSummary = typeof data.summary === "string" && data.summary.trim().length > 0;
  if (hasSummary) {
    passed++;
  } else {
    findings.push({
      id: "struct-missing-summary",
      category: ResumeQualityCategory.ATS_STRUCTURE,
      severity: FindingSeverity.LOW,
      title: "Professional Summary not included",
      description: "A summary provides a high-level executive pitch at the top of your resume.",
      whyItMatters:
        "A concise 2-3 sentence summary immediately frames your seniority and core technical focus for recruiters.",
      recommendation:
        "Consider adding a focused professional summary highlighting your key achievements and target role.",
      section: "summary",
    });
  }

  // 3. Empty Sections Detection
  total++;
  const emptySections: string[] = [];
  if (data.experience && data.experience.length === 0) emptySections.push("Experience");
  if (data.education && data.education.length === 0) emptySections.push("Education");
  if (data.projects && data.projects.length === 0 && data.sectionVisibility?.showProjects) {
    emptySections.push("Projects");
  }
  if (data.skills && data.skills.length === 0 && data.sectionVisibility?.showSkills) {
    emptySections.push("Skills");
  }

  if (emptySections.length === 0) {
    passed++;
  } else {
    findings.push({
      id: "struct-empty-sections",
      category: ResumeQualityCategory.ATS_STRUCTURE,
      severity: FindingSeverity.MEDIUM,
      title: `Empty section visible: ${emptySections.join(", ")}`,
      description: `The following sections are enabled but contain no items: ${emptySections.join(", ")}.`,
      whyItMatters:
        "Empty headings can confuse ATS parsers and present an incomplete visual appearance to recruiters.",
      recommendation:
        "Populate these sections with relevant details or toggle off their visibility in Section Settings.",
    });
  }

  // 4. Section Order Logic (Contact should precede Experience/Education)
  total++;
  const sectionOrder = data.sectionOrder || [];
  if (sectionOrder.length > 0) {
    const summaryIdx = sectionOrder.indexOf("summary");
    const expIdx = sectionOrder.indexOf("experience");
    const eduIdx = sectionOrder.indexOf("education");

    const orderAnomaly =
      (summaryIdx > 0 && expIdx >= 0 && summaryIdx > expIdx) ||
      (eduIdx >= 0 && expIdx >= 0 && eduIdx < expIdx && hasExperience && data.experience.length >= 2);

    if (!orderAnomaly) {
      passed++;
    } else {
      findings.push({
        id: "struct-unusual-order",
        category: ResumeQualityCategory.ATS_STRUCTURE,
        severity: FindingSeverity.INFO,
        title: "Section order could be improved",
        description:
          "Professional summary is positioned after experience, or education precedes extensive experience.",
        whyItMatters:
          "Standard ATS flow reads: Contact -> Summary -> Experience -> Education -> Skills/Projects.",
        recommendation:
          "Place Summary before Experience, and position Experience before Education if you have professional tenure.",
      });
    }
  } else {
    passed++;
  }

  return {
    category: ResumeQualityCategory.ATS_STRUCTURE,
    findings,
    passedChecksCount: passed,
    totalChecksCount: total,
    metrics: {
      hasExperience,
      hasEducation,
      hasSkills,
      hasSummary,
      hasPersonalInfo,
      emptySections,
    },
  };
}
