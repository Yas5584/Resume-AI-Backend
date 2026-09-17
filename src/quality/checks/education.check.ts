import {
  ResumeData,
  Education,
  Certification,
  ResumeQualityFinding,
  ResumeQualityCategory,
  FindingSeverity,
} from "@resumeai/shared";
import { DeterministicCheckResult } from "../types.js";

/**
 * Checks education entries, degree titles, institutions, graduation dates,
 * and optional certifications with credential URLs.
 */
export function checkEducationAndCertifications(
  data: ResumeData,
): DeterministicCheckResult {
  const findings: ResumeQualityFinding[] = [];
  const educationList: Education[] = data.education || [];
  const certList: Certification[] = data.certifications || [];

  let passed = 0;
  let total = 0;

  // 1. Education Presence
  total++;
  if (educationList.length === 0) {
    findings.push({
      id: "edu-none",
      category: ResumeQualityCategory.EDUCATION_CERTIFICATIONS,
      severity: FindingSeverity.HIGH,
      title: "No education entries listed",
      description: "No degree, university, or educational background provided.",
      whyItMatters:
        "Many ATS filters verify degree requirements (e.g. Bachelor's in CS or equivalent) as an initial screen.",
      recommendation: "Add your highest degree, field of study, and institution.",
      section: "education",
    });
  } else {
    passed++;
  }

  // 2. Degree & Institution Completeness
  total++;
  let allEntriesComplete = true;
  educationList.forEach((edu, idx) => {
    if (!edu.institution || !edu.institution.trim()) {
      allEntriesComplete = false;
      findings.push({
        id: `edu-missing-inst-${edu.id || idx}`,
        category: ResumeQualityCategory.EDUCATION_CERTIFICATIONS,
        severity: FindingSeverity.HIGH,
        title: `Missing institution for ${edu.degree || `Education #${idx + 1}`}`,
        description: "School, university, or college name is missing.",
        whyItMatters: "Recruiters and automated verification services require institution names.",
        recommendation: "Provide the name of the granting university or educational institution.",
        section: "education",
        itemId: edu.id,
        field: "institution",
      });
    }

    if (!edu.degree || !edu.degree.trim()) {
      allEntriesComplete = false;
      findings.push({
        id: `edu-missing-degree-${edu.id || idx}`,
        category: ResumeQualityCategory.EDUCATION_CERTIFICATIONS,
        severity: FindingSeverity.HIGH,
        title: `Missing degree for ${edu.institution || `Education #${idx + 1}`}`,
        description: "Degree or certification type is missing.",
        whyItMatters: "ATS systems match specific degree levels (BS, MS, PhD) against minimum requirements.",
        recommendation: "Specify your degree title (e.g. Bachelor of Science in Computer Science).",
        section: "education",
        itemId: edu.id,
        field: "degree",
      });
    }

    if (!edu.endDate || !edu.endDate.trim()) {
      if (!edu.current) {
        findings.push({
          id: `edu-missing-date-${edu.id || idx}`,
          category: ResumeQualityCategory.EDUCATION_CERTIFICATIONS,
          severity: FindingSeverity.LOW,
          title: `Missing graduation date for ${edu.degree || edu.institution}`,
          description: "No completion or expected graduation date is specified.",
          whyItMatters: "Helps recruiters verify candidate graduation status and timeline.",
          recommendation: "Provide your graduation year or expected completion date.",
          section: "education",
          itemId: edu.id,
          field: "endDate",
        });
      }
    }
  });

  if (allEntriesComplete && educationList.length > 0) {
    passed++;
  }

  // 3. Certifications Check (if present)
  total++;
  let certsValid = true;
  certList.forEach((cert, idx) => {
    if (!cert.name || !cert.name.trim()) {
      certsValid = false;
      findings.push({
        id: `cert-missing-name-${cert.id || idx}`,
        category: ResumeQualityCategory.EDUCATION_CERTIFICATIONS,
        severity: FindingSeverity.LOW,
        title: "Certification missing title",
        description: "A certification item has no title specified.",
        whyItMatters: "ATS filters cannot match unnamed certifications.",
        recommendation: "Provide the full certification name (e.g. AWS Certified Solutions Architect).",
        section: "certifications",
        itemId: cert.id,
        field: "name",
      });
    }
  });
  if (certsValid) passed++;

  return {
    category: ResumeQualityCategory.EDUCATION_CERTIFICATIONS,
    findings,
    passedChecksCount: passed,
    totalChecksCount: total,
    metrics: {
      educationCount: educationList.length,
      certificationsCount: certList.length,
    },
  };
}
