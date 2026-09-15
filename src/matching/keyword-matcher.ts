import { ResumeData, JobAnalysis } from "@resumeai/shared";

export interface KeywordMatchResult {
  score: number; // 0 to 100
  matchedKeywords: string[];
  missingKeywords: string[];
  matchedCount: number;
  totalCount: number;
  details: string;
}

export function matchKeywords(
  jobAnalysis: JobAnalysis,
  resumeData: ResumeData,
): KeywordMatchResult {
  const jobKeywords = jobAnalysis.keywords || [];

  if (jobKeywords.length === 0) {
    return {
      score: 100,
      matchedKeywords: [],
      missingKeywords: [],
      matchedCount: 0,
      totalCount: 0,
      details: "No domain keywords specified",
    };
  }

  // De-duplicate unique job keywords
  const uniqueJobKeywordsMap = new Map<string, (typeof jobKeywords)[0]>();
  for (const kw of jobKeywords) {
    const key = kw.keyword.trim().toLowerCase();
    if (key && !uniqueJobKeywordsMap.has(key)) {
      uniqueJobKeywordsMap.set(key, kw);
    }
  }

  // Extract all resume text into a single searchable string
  const textChunks: string[] = [];
  if (resumeData.summary) textChunks.push(resumeData.summary);
  if (Array.isArray(resumeData.skills)) {
    for (const s of resumeData.skills) {
      if (Array.isArray(s.skills)) textChunks.push(...s.skills);
    }
  }
  if (Array.isArray(resumeData.experience)) {
    for (const exp of resumeData.experience) {
      if (exp.jobTitle) textChunks.push(exp.jobTitle);
      if (exp.position) textChunks.push(exp.position);
      if (exp.description) textChunks.push(exp.description);
      if (Array.isArray(exp.bullets)) textChunks.push(...exp.bullets);
      if (Array.isArray(exp.technologiesUsed))
        textChunks.push(...exp.technologiesUsed);
    }
  }
  if (Array.isArray(resumeData.projects)) {
    for (const p of resumeData.projects) {
      if (p.name) textChunks.push(p.name);
      if (p.description) textChunks.push(p.description);
      if (Array.isArray(p.bullets)) textChunks.push(...p.bullets);
      if (Array.isArray(p.technologies)) textChunks.push(...p.technologies);
    }
  }
  if (Array.isArray(resumeData.education)) {
    for (const edu of resumeData.education) {
      if (edu.degree) textChunks.push(edu.degree);
      if (edu.fieldOfStudy) textChunks.push(edu.fieldOfStudy);
    }
  }
  if (Array.isArray(resumeData.certifications)) {
    for (const c of resumeData.certifications) {
      if (c.name) textChunks.push(c.name);
    }
  }

  const fullResumeText = textChunks.join(" ").toLowerCase();

  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  for (const [kwLower, kwObj] of uniqueJobKeywordsMap.entries()) {
    // Regex whole word boundary check
    const escaped = kwLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");

    if (regex.test(fullResumeText)) {
      matchedKeywords.push(kwObj.keyword);
    } else {
      missingKeywords.push(kwObj.keyword);
    }
  }

  const total = uniqueJobKeywordsMap.size;
  const matched = matchedKeywords.length;
  const score =
    total > 0
      ? Math.min(100, Math.max(0, Math.round((matched / total) * 100)))
      : 100;

  return {
    score,
    matchedKeywords,
    missingKeywords,
    matchedCount: matched,
    totalCount: total,
    details: `Matched ${matched} of ${total} unique ATS domain keywords (${score}% coverage)`,
  };
}
