import { ResumeData, JobAnalysis } from "@resumeai/shared";

export interface ExperienceMatchResult {
  score: number; // 0 to 100
  candidateYears: number;
  requiredYears: number;
  details: string;
  matchedCount: number;
  totalCount: number;
  matchState?: "MATCHED" | "PARTIAL" | "MISSING";
}

const MONTH_NAMES: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

/**
 * Parses date string into [year, month] (0-indexed month)
 */
export function parseDateToMonthIndex(
  dateStr?: string,
  isEnd: boolean = false,
  isCurrent: boolean = false,
): number | null {
  if (isCurrent || (dateStr && /\b(?:present|current|now)\b/i.test(dateStr))) {
    const now = new Date();
    return now.getFullYear() * 12 + now.getMonth();
  }

  if (!dateStr || !dateStr.trim()) {
    if (isEnd) {
      const now = new Date();
      return now.getFullYear() * 12 + now.getMonth();
    }
    return null;
  }

  const clean = dateStr.trim();

  // Pattern 1: "Sep 2025" or "September 2025"
  const monthYearMatch = clean.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[.,\s]+(19\d\d|20\d\d)\b/i,
  );
  if (monthYearMatch) {
    const month =
      MONTH_NAMES[monthYearMatch[1].toLowerCase()] ?? (isEnd ? 11 : 0);
    const year = parseInt(monthYearMatch[2], 10);
    return year * 12 + month;
  }

  // Pattern 2: "2024-11" or "11/2024"
  const isoMatch = clean.match(/\b(19\d\d|20\d\d)[-/.](\d{1,2})\b/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = Math.min(11, Math.max(0, parseInt(isoMatch[2], 10) - 1));
    return year * 12 + month;
  }

  const slashMatch = clean.match(/\b(\d{1,2})[-/.](19\d\d|20\d\d)\b/);
  if (slashMatch) {
    const month = Math.min(11, Math.max(0, parseInt(slashMatch[1], 10) - 1));
    const year = parseInt(slashMatch[2], 10);
    return year * 12 + month;
  }

  // Pattern 3: Year only, e.g. "2024"
  const yearOnlyMatch = clean.match(/\b(19\d\d|20\d\d)\b/);
  if (yearOnlyMatch) {
    const year = parseInt(yearOnlyMatch[1], 10);
    return year * 12 + (isEnd ? 11 : 0);
  }

  return null;
}

/**
 * Extracts approximate duration in years from start and end dates (single role)
 */
export function estimateExperienceYears(
  startDate?: string,
  endDate?: string,
  current?: boolean,
): number {
  const startIdx = parseDateToMonthIndex(startDate, false, false);
  const endIdx = parseDateToMonthIndex(endDate, true, current);

  if (startIdx === null) return 0;
  const effectiveEnd = endIdx !== null ? endIdx : startIdx;
  const months = Math.max(1, effectiveEnd - startIdx + 1);
  return Math.round((months / 12) * 10) / 10;
}

/**
 * Merges overlapping employment intervals to prevent double-counting
 */
export function calculateNonOverlappingYears(
  experiences: Array<{
    startDate?: string;
    endDate?: string;
    current?: boolean;
  }>,
): number {
  const intervals: Array<[number, number]> = [];

  for (const exp of experiences) {
    const startIdx = parseDateToMonthIndex(exp.startDate, false, false);
    const endIdx = parseDateToMonthIndex(exp.endDate, true, exp.current);

    if (startIdx !== null) {
      const effectiveEnd = endIdx !== null ? endIdx : startIdx;
      if (effectiveEnd >= startIdx) {
        intervals.push([startIdx, effectiveEnd]);
      }
    }
  }

  if (intervals.length === 0) return 0;

  // Sort intervals by start month
  intervals.sort((a, b) => a[0] - b[0]);

  // Merge overlapping or contiguous intervals
  const merged: Array<[number, number]> = [];
  for (const interval of intervals) {
    if (merged.length === 0) {
      merged.push([...interval]);
    } else {
      const last = merged[merged.length - 1];
      if (interval[0] <= last[1] + 1) {
        last[1] = Math.max(last[1], interval[1]);
      } else {
        merged.push([...interval]);
      }
    }
  }

  // Sum total non-overlapping months
  const totalMonths = merged.reduce(
    (sum, [start, end]) => sum + (end - start + 1),
    0,
  );

  return Math.round((totalMonths / 12) * 10) / 10;
}

export function matchExperience(
  jobAnalysis: JobAnalysis,
  resumeData: ResumeData,
): ExperienceMatchResult {
  const experiences = resumeData.experience || [];

  // Calculate non-overlapping candidate experience tenure
  const totalCandidateYears = calculateNonOverlappingYears(experiences);

  // Determine required years from JobAnalysis
  let requiredYears = jobAnalysis.experienceYearsMinimum || 0;
  if (
    Array.isArray(jobAnalysis.experience) &&
    jobAnalysis.experience.length > 0
  ) {
    for (const expReq of jobAnalysis.experience) {
      if (expReq.yearsMin && expReq.yearsMin > requiredYears) {
        requiredYears = expReq.yearsMin;
      }
    }
  }

  if (requiredYears === 0) {
    // If job does not specify required years
    const score = experiences.length > 0 ? 100 : 80;
    return {
      score,
      candidateYears: totalCandidateYears,
      requiredYears: 0,
      details: `Demonstrates ${totalCandidateYears} years of experience across ${experiences.length} roles (no minimum specified)`,
      matchedCount: experiences.length > 0 ? 1 : 0,
      totalCount: 1,
      matchState: "MATCHED",
    };
  }

  // If candidate meets or exceeds required tenure
  if (totalCandidateYears >= requiredYears) {
    return {
      score: 100,
      candidateYears: totalCandidateYears,
      requiredYears,
      details: `Demonstrates ${totalCandidateYears} of ${requiredYears}+ required years of professional experience`,
      matchedCount: 1,
      totalCount: 1,
      matchState: "MATCHED",
    };
  }

  // Candidate is under-tenured: strictly deterministic ratio
  const ratio = totalCandidateYears / requiredYears;
  const score = Math.min(85, Math.max(0, Math.round(ratio * 100)));

  const matchState: "PARTIAL" | "MISSING" =
    ratio >= 0.6 ? "PARTIAL" : "MISSING";

  return {
    score,
    candidateYears: totalCandidateYears,
    requiredYears,
    details: `Demonstrates ${totalCandidateYears} of ${requiredYears}+ required years of professional experience (Deficit of ${(requiredYears - totalCandidateYears).toFixed(1)} years)`,
    matchedCount: 0,
    totalCount: 1,
    matchState,
  };
}
