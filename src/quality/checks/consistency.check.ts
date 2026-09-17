import {
  ResumeData,
  ResumeQualityFinding,
  ResumeQualityCategory,
  FindingSeverity,
} from "@resumeai/shared";
import { DeterministicCheckResult } from "../types.js";

// Date format signatures
const MONTH_YEAR_WORD_REGEX = /^(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}$/i;
const NUMERIC_DATE_REGEX = /^\d{1,2}[\/\-]\d{4}$/;
const YEAR_ONLY_REGEX = /^\d{4}$/;

function parseDateYear(dateStr: string): number | null {
  const match = dateStr.match(/\b(19\d{2}|20\d{2})\b/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Validates date formatting consistency, chronological order,
 * future dates, and detects duplicate bullets or entries.
 */
export function checkConsistencyAndDuplication(
  data: ResumeData,
): DeterministicCheckResult {
  const findings: ResumeQualityFinding[] = [];
  let passed = 0;
  let total = 0;

  const currentYear = new Date().getFullYear();

  // 1. Date Format Uniformity across Experience
  total++;
  const dateFormatsFound = new Set<string>();
  const experiences = data.experience || [];

  experiences.forEach((exp) => {
    [exp.startDate, exp.endDate].forEach((d) => {
      if (d && d.trim() && !d.toLowerCase().includes("present")) {
        const trimmed = d.trim();
        if (MONTH_YEAR_WORD_REGEX.test(trimmed)) {
          dateFormatsFound.add("Month YYYY (e.g. Jan 2023)");
        } else if (NUMERIC_DATE_REGEX.test(trimmed)) {
          dateFormatsFound.add("MM/YYYY (e.g. 01/2023)");
        } else if (YEAR_ONLY_REGEX.test(trimmed)) {
          dateFormatsFound.add("YYYY (e.g. 2023)");
        } else {
          dateFormatsFound.add("Other/Custom");
        }
      }
    });
  });

  if (dateFormatsFound.size <= 1) {
    passed++;
  } else {
    findings.push({
      id: "consist-mixed-date-formats",
      category: ResumeQualityCategory.CONSISTENCY,
      severity: FindingSeverity.MEDIUM,
      title: "Mixed date formats detected",
      description: `Resume uses multiple date styles across positions: ${Array.from(dateFormatsFound).join(", ")}.`,
      whyItMatters:
        "Consistent date formatting (e.g. always 'Jan 2024' or '01/2024') presents a polished, meticulous document.",
      recommendation:
        "Standardize all dates to a single consistent format across experience and education.",
      section: "experience",
    });
  }

  // 2. Chronological Sanity & Future Dates
  total++;
  let datesSensible = true;

  experiences.forEach((exp, idx) => {
    const startYear = exp.startDate ? parseDateYear(exp.startDate) : null;
    const endYear = exp.endDate ? parseDateYear(exp.endDate) : null;

    if (startYear && startYear > currentYear + 1) {
      datesSensible = false;
      findings.push({
        id: `consist-future-date-${exp.id || idx}`,
        category: ResumeQualityCategory.CONSISTENCY,
        severity: FindingSeverity.HIGH,
        title: `Future start date at ${exp.company || "Role"}`,
        description: `Start date year (${startYear}) is set in the future.`,
        whyItMatters: "Future dates in past work history flag data entry errors during ATS ingestion.",
        recommendation: "Verify that the start year reflects past or current employment.",
        section: "experience",
        itemId: exp.id,
        evidence: exp.startDate,
      });
    }

    if (startYear && endYear && endYear < startYear) {
      datesSensible = false;
      findings.push({
        id: `consist-inverted-dates-${exp.id || idx}`,
        category: ResumeQualityCategory.CONSISTENCY,
        severity: FindingSeverity.HIGH,
        title: `End date precedes start date at ${exp.company || "Role"}`,
        description: `End date (${exp.endDate}) is earlier than start date (${exp.startDate}).`,
        whyItMatters: "Inverted chronological dates corrupt ATS work duration calculations.",
        recommendation: "Ensure start date comes before end date.",
        section: "experience",
        itemId: exp.id,
        evidence: `${exp.startDate} – ${exp.endDate}`,
      });
    }

    if (!exp.current && !exp.endDate) {
      datesSensible = false;
      findings.push({
        id: `consist-missing-end-date-${exp.id || idx}`,
        category: ResumeQualityCategory.CONSISTENCY,
        severity: FindingSeverity.MEDIUM,
        title: `Unspecified status at ${exp.company || "Role"}`,
        description: "Position has no end date but is not marked as currently active.",
        whyItMatters: "ATS filters cannot discern whether you are presently employed there.",
        recommendation: "Mark as 'Present' / Current, or provide an end date.",
        section: "experience",
        itemId: exp.id,
      });
    }
  });

  if (datesSensible) passed++;

  // 3. Duplicate Bullet Points Detection
  total++;
  const seenBullets = new Map<string, string>();
  const duplicateBullets: string[] = [];

  experiences.forEach((exp) => {
    (exp.bullets || []).forEach((b) => {
      const normalized = b.trim().toLowerCase().replace(/[^\w\s]/g, "");
      if (normalized.length > 20) {
        if (seenBullets.has(normalized)) {
          duplicateBullets.push(b.trim());
        } else {
          seenBullets.set(normalized, exp.company || "Experience");
        }
      }
    });
  });

  if (duplicateBullets.length === 0) {
    passed++;
  } else {
    findings.push({
      id: "consist-duplicate-bullets",
      category: ResumeQualityCategory.CONSISTENCY,
      severity: FindingSeverity.MEDIUM,
      title: "Duplicate bullet points detected across roles",
      description: `Found ${duplicateBullets.length} identical or nearly identical bullet point(s).`,
      whyItMatters:
        "Repeating the exact same bullet across positions suggests boilerplate copy-pasting rather than specific accomplishments.",
      recommendation: "Differentiate each bullet to reflect the unique deliverables of that position.",
      section: "experience",
      evidence: duplicateBullets[0].slice(0, 80),
    });
  }

  // 4. Duplicate Positions / Companies Check
  total++;
  let duplicateRoles = false;
  const roleKeys = new Set<string>();

  experiences.forEach((exp) => {
    if (exp.company && exp.jobTitle) {
      const key = `${exp.company.trim().toLowerCase()}::${exp.jobTitle.trim().toLowerCase()}`;
      if (roleKeys.has(key)) {
        duplicateRoles = true;
      } else {
        roleKeys.add(key);
      }
    }
  });

  if (!duplicateRoles) {
    passed++;
  } else {
    findings.push({
      id: "consist-duplicate-roles",
      category: ResumeQualityCategory.CONSISTENCY,
      severity: FindingSeverity.LOW,
      title: "Duplicate role title and company",
      description: "Multiple entries share the identical title and employer name.",
      whyItMatters: "Can create redundant sections unless indicating consecutive promotions.",
      recommendation: "Consolidate duplicate roles under a single employer entry if possible.",
      section: "experience",
    });
  }

  return {
    category: ResumeQualityCategory.CONSISTENCY,
    findings,
    passedChecksCount: passed,
    totalChecksCount: total,
    metrics: {
      dateFormatsCount: dateFormatsFound.size,
      duplicateBulletsCount: duplicateBullets.length,
      duplicateRoles,
    },
  };
}
