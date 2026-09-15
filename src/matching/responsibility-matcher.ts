import {
  ResumeData,
  JobAnalysis,
  MatchedRequirementItem,
} from "@resumeai/shared";
import { calculateNonOverlappingYears } from "./experience-matcher.js";

export interface ResponsibilityMatchResult {
  score: number; // 0 to 100
  matchedItems: MatchedRequirementItem[];
  missingItems: MatchedRequirementItem[];
  partialItems: MatchedRequirementItem[];
  matchedCount: number;
  totalCount: number;
  details: string;
}

const STOPWORDS = new Set([
  "with",
  "from",
  "that",
  "this",
  "have",
  "been",
  "using",
  "work",
  "develop",
  "performing",
  "perform",
  "build",
  "lead",
  "help",
  "make",
  "create",
  "support",
  "team",
  "solutions",
  "problems",
  "business",
  "services",
  "system",
  "systems",
  "experience",
  "required",
  "knowledge",
  "candidate",
  "strong",
  "hands",
  "demonstrated",
  "working",
  "across",
  "other",
  "into",
  "their",
  "will",
  "able",
  "should",
]);

/**
 * Evaluates core job responsibilities and unified requirements
 * with conservative concept-aware matching and strict evidence requirements.
 */
export function matchResponsibilities(
  jobAnalysis: JobAnalysis,
  resumeData: ResumeData,
): ResponsibilityMatchResult {
  const responsibilities = jobAnalysis.responsibilities || [];
  const requirements = jobAnalysis.requirements || [];

  // Gather all resume action bullets
  const candidateBullets: string[] = [];
  if (Array.isArray(resumeData.experience)) {
    for (const exp of resumeData.experience) {
      if (Array.isArray(exp.bullets)) {
        for (const b of exp.bullets) {
          if (b.trim()) candidateBullets.push(b.trim());
        }
      }
      if (exp.description?.trim()) {
        candidateBullets.push(exp.description.trim());
      }
    }
  }
  if (Array.isArray(resumeData.projects)) {
    for (const proj of resumeData.projects) {
      if (Array.isArray(proj.bullets)) {
        for (const b of proj.bullets) {
          if (b.trim()) candidateBullets.push(b.trim());
        }
      }
      if (proj.description?.trim()) {
        candidateBullets.push(proj.description.trim());
      }
    }
  }

  // Helper: check if a phrase is present in resume skills or bullets
  const checkResumeMatch = (phrase: string): string | null => {
    const clean = phrase.toLowerCase().trim();
    if (!clean) return null;

    // Check skills
    if (Array.isArray(resumeData.skills)) {
      for (const cat of resumeData.skills) {
        for (const s of cat.skills || []) {
          const sLower = s.toLowerCase();
          if (sLower === clean) {
            return `Skill: ${s}`;
          }
          // Exact regex match for multi-word skill
          const escaped = sLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          if (new RegExp(`\\b${escaped}\\b`, "i").test(clean)) {
            // Guard: generic skills (python, sql, data processing) must not satisfy named platforms (databricks, pyspark)
            if (
              (clean.includes("databricks") &&
                !sLower.includes("databricks")) ||
              (clean.includes("pyspark") && !sLower.includes("pyspark")) ||
              (clean.includes("microservices") &&
                !sLower.includes("microservice"))
            ) {
              continue;
            }
            return `Skill: ${s}`;
          }
        }
      }
    }

    // Check bullets
    const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    for (const b of candidateBullets) {
      if (regex.test(b)) {
        return b;
      }
    }
    return null;
  };

  const matchedItems: MatchedRequirementItem[] = [];
  const missingItems: MatchedRequirementItem[] = [];
  const partialItems: MatchedRequirementItem[] = [];

  let earnedPoints = 0;
  const totalItemsCount = responsibilities.length + requirements.length;
  const totalPoints = Math.max(1, totalItemsCount);

  // 1. Evaluate Responsibilities
  for (const resp of responsibilities) {
    const respText = resp.text.trim();
    const respLower = respText.toLowerCase();

    // Guard 1: Microservices
    const requiresMicroservices = /\bmicro-?services?\b/i.test(respLower);
    if (requiresMicroservices) {
      const hasMicroservicesEvidence = candidateBullets.some((b) =>
        /\bmicro-?services?\b/i.test(b),
      );

      if (hasMicroservicesEvidence) {
        const bullet = candidateBullets.find((b) =>
          /\bmicro-?services?\b/i.test(b),
        )!;
        earnedPoints += 1.0;
        matchedItems.push({
          requirement: respText,
          importance: resp.importance || "REQUIRED",
          matchType: "MATCHED",
          resumeEvidence: [bullet],
          jobEvidence: resp.evidence || respText,
          confidence: 0.95,
          relationship: "OPTIONAL",
        });
      } else {
        // Check if candidate has general backend/REST API experience for PARTIAL
        const backendBullet = candidateBullets.find((b) =>
          /\b(?:backend|rest\s*apis?|apis?|node\.js|express)\b/i.test(b),
        );
        if (backendBullet) {
          earnedPoints += 0.4;
          partialItems.push({
            requirement: respText,
            importance: resp.importance || "REQUIRED",
            matchType: "PARTIAL",
            resumeEvidence: [backendBullet],
            jobEvidence: resp.evidence || respText,
            confidence: 0.6,
            relationship: "OPTIONAL",
            reason:
              "Evidence establishes REST API and backend development, but does not establish scalable microservices architecture.",
          });
        } else {
          missingItems.push({
            requirement: respText,
            importance: resp.importance || "REQUIRED",
            matchType: "MISSING",
            resumeEvidence: [],
            jobEvidence: resp.evidence || respText,
            confidence: 1.0,
            relationship: "OPTIONAL",
            reason: "Not found in the resume",
          });
        }
      }
      continue;
    }

    // Guard 2: Databricks
    if (/\bdatabricks\b/i.test(respLower)) {
      const hasDatabricks = candidateBullets.some((b) =>
        /\bdatabricks\b/i.test(b),
      );
      if (!hasDatabricks) {
        missingItems.push({
          requirement: respText,
          importance: resp.importance || "REQUIRED",
          matchType: "MISSING",
          resumeEvidence: [],
          jobEvidence: resp.evidence || respText,
          confidence: 1.0,
          relationship: "OPTIONAL",
          reason: "Databricks platform experience not found in resume.",
        });
        continue;
      }
    }

    // Concept words extraction
    const words = respLower
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w));

    let bestMatchingBullet: string | null = null;
    let maxOverlap = 0;

    for (const bullet of candidateBullets) {
      const bLower = bullet.toLowerCase();
      let overlap = 0;
      for (const word of words) {
        if (new RegExp(`\\b${word}\\b`, "i").test(bLower)) {
          overlap++;
        }
      }
      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        bestMatchingBullet = bullet;
      }
    }

    const overlapRatio = words.length > 0 ? maxOverlap / words.length : 0;

    // Strict threshold: >= 40% concept overlap AND at least 2 distinct domain words
    if (
      words.length > 0 &&
      overlapRatio >= 0.4 &&
      maxOverlap >= 2 &&
      bestMatchingBullet
    ) {
      earnedPoints += 1.0;
      matchedItems.push({
        requirement: respText,
        importance: resp.importance || "REQUIRED",
        matchType: "MATCHED",
        resumeEvidence: [bestMatchingBullet],
        jobEvidence: resp.evidence || respText,
        confidence: 0.9,
        relationship: "OPTIONAL",
      });
    } else if (
      words.length > 0 &&
      (overlapRatio >= 0.2 || maxOverlap >= 1) &&
      bestMatchingBullet
    ) {
      earnedPoints += 0.5;
      partialItems.push({
        requirement: respText,
        importance: resp.importance || "REQUIRED",
        matchType: "PARTIAL",
        resumeEvidence: [bestMatchingBullet],
        jobEvidence: resp.evidence || respText,
        confidence: 0.6,
        relationship: "OPTIONAL",
        reason: "Partially aligns with demonstrated project accomplishments",
      });
    } else {
      missingItems.push({
        requirement: respText,
        importance: resp.importance || "REQUIRED",
        matchType: "MISSING",
        resumeEvidence: [],
        jobEvidence: resp.evidence || respText,
        confidence: 1.0,
        relationship: "OPTIONAL",
        reason: "Not found in the resume",
      });
    }
  }

  // 2. Evaluate Unified Requirements (with OR / AND / Negation logic)
  for (const req of requirements) {
    const text = req.text.trim();
    const textLower = text.toLowerCase();

    // Check for Negation (e.g., "no ... required", "not required")
    const isNegated =
      /\bno\b.*\brequired\b/i.test(text) ||
      /\bnot\b.*\brequired\b/i.test(text) ||
      /\boptional\b/i.test(text);

    if (isNegated) {
      earnedPoints += 1.0;
      matchedItems.push({
        requirement: text,
        importance: req.importance || "PREFERRED",
        matchType: "MATCHED",
        resumeEvidence: ["Explicitly marked as not required in job posting"],
        jobEvidence: req.evidence || text,
        confidence: 1.0,
        relationship: req.relationship || "OPTIONAL",
        reason: "Explicit non-requirement in job description",
      });
      continue;
    }

    // Check for experience tenure requirement (e.g., "7+ years", "5+ years", "3+ years")
    const yearsMatch = textLower.match(/(\d+)\+?\s*years?/i);
    if (yearsMatch) {
      const reqYears = parseInt(yearsMatch[1], 10);
      const candidateYears = calculateNonOverlappingYears(
        resumeData.experience || [],
      );
      if (reqYears > 0 && candidateYears < reqYears * 0.6) {
        missingItems.push({
          requirement: text,
          importance: req.importance || "REQUIRED",
          matchType: "MISSING",
          resumeEvidence: [],
          jobEvidence: req.evidence || text,
          confidence: 1.0,
          relationship: req.relationship || "OPTIONAL",
          reason: `Requires ${reqYears}+ years of professional experience; candidate resume establishes only ${candidateYears.toFixed(1)} years (deficit of ${(reqYears - candidateYears).toFixed(1)} years).`,
        });
        continue;
      } else if (reqYears > 0 && candidateYears < reqYears) {
        earnedPoints += 0.4;
        partialItems.push({
          requirement: text,
          importance: req.importance || "REQUIRED",
          matchType: "PARTIAL",
          resumeEvidence: [
            `Demonstrates ${candidateYears.toFixed(1)} of ${reqYears}+ required years`,
          ],
          jobEvidence: req.evidence || text,
          confidence: 0.8,
          relationship: req.relationship || "OPTIONAL",
          reason: `Candidate demonstrates ${candidateYears.toFixed(1)} of ${reqYears}+ required years of professional experience.`,
        });
        continue;
      }
    }

    // Check for Named Platforms: Databricks, PySpark
    if (/\bdatabricks\b/i.test(textLower)) {
      const found = checkResumeMatch("databricks");
      if (!found) {
        missingItems.push({
          requirement: text,
          importance: req.importance || "REQUIRED",
          matchType: "MISSING",
          resumeEvidence: [],
          jobEvidence: req.evidence || text,
          confidence: 1.0,
          relationship: req.relationship || "OPTIONAL",
          reason: "No supporting Databricks evidence found in resume.",
        });
        continue;
      }
    }

    if (/\b(?:pyspark|apache\s*spark)\b/i.test(textLower)) {
      const found = checkResumeMatch("pyspark") || checkResumeMatch("spark");
      if (!found) {
        missingItems.push({
          requirement: text,
          importance: req.importance || "PREFERRED",
          matchType: "MISSING",
          resumeEvidence: [],
          jobEvidence: req.evidence || text,
          confidence: 1.0,
          relationship: req.relationship || "OPTIONAL",
          reason: "No supporting PySpark/Spark evidence found in resume.",
        });
        continue;
      }
    }

    // Check for OR logic
    if (
      req.relationship === "OR" ||
      (textLower.includes(" or ") && !req.relationship)
    ) {
      const options =
        req.relatedRequirements && req.relatedRequirements.length > 0
          ? req.relatedRequirements
          : text
              .split(/\bor\b/i)
              .map((s) =>
                s
                  .replace(
                    /^.*(?:must know|experience in|proficient in)\s+/i,
                    "",
                  )
                  .trim(),
              );

      let satisfiedEvidence: string | null = null;
      for (const opt of options) {
        const found = checkResumeMatch(opt);
        if (found) {
          satisfiedEvidence = `Satisfied via ${opt}: ${found}`;
          break;
        }
      }

      if (satisfiedEvidence) {
        earnedPoints += 1.0;
        matchedItems.push({
          requirement: text,
          importance: req.importance || "REQUIRED",
          matchType: "MATCHED",
          resumeEvidence: [satisfiedEvidence],
          jobEvidence: req.evidence || text,
          confidence: 1.0,
          relationship: "OR",
        });
      } else {
        missingItems.push({
          requirement: text,
          importance: req.importance || "REQUIRED",
          matchType: "MISSING",
          resumeEvidence: [],
          jobEvidence: req.evidence || text,
          confidence: 1.0,
          relationship: "OR",
          reason: "None of the OR alternative options were found in the resume",
        });
      }
      continue;
    }

    // Check for AND logic
    if (req.relationship === "AND") {
      const options =
        req.relatedRequirements && req.relatedRequirements.length > 0
          ? req.relatedRequirements
          : text
              .split(/\band\b/i)
              .map((s) => s.trim())
              .filter(Boolean);

      const satisfiedList: string[] = [];
      for (const opt of options) {
        const found = checkResumeMatch(opt);
        if (found) {
          satisfiedList.push(`${opt}: ${found}`);
        }
      }

      if (satisfiedList.length === options.length && options.length > 0) {
        earnedPoints += 1.0;
        matchedItems.push({
          requirement: text,
          importance: req.importance || "REQUIRED",
          matchType: "MATCHED",
          resumeEvidence: satisfiedList,
          jobEvidence: req.evidence || text,
          confidence: 0.95,
          relationship: "AND",
        });
      } else if (satisfiedList.length > 0) {
        earnedPoints += 0.5;
        partialItems.push({
          requirement: text,
          importance: req.importance || "REQUIRED",
          matchType: "PARTIAL",
          resumeEvidence: satisfiedList,
          jobEvidence: req.evidence || text,
          confidence: 0.7,
          relationship: "AND",
          reason: `Satisfied ${satisfiedList.length} of ${options.length} required joint criteria`,
        });
      } else {
        missingItems.push({
          requirement: text,
          importance: req.importance || "REQUIRED",
          matchType: "MISSING",
          resumeEvidence: [],
          jobEvidence: req.evidence || text,
          confidence: 1.0,
          relationship: "AND",
          reason: "Not found in the resume",
        });
      }
      continue;
    }

    // Recommendation Systems
    if (/\brecommendation\s*systems?\b/i.test(textLower)) {
      const recommenderBullet = candidateBullets.find((b) =>
        /\brecommend(?:ation|er)?\s*systems?|cosine\s*similarity|content-based\s*recommendation\b/i.test(
          b,
        ),
      );
      if (recommenderBullet) {
        earnedPoints += 1.0;
        matchedItems.push({
          requirement: text,
          importance: req.importance || "REQUIRED",
          matchType: "MATCHED",
          resumeEvidence: [recommenderBullet],
          jobEvidence: req.evidence || text,
          confidence: 0.95,
          relationship: "OPTIONAL",
        });
        continue;
      }
    }

    // Default requirement match via keyword/bullet check
    const match = checkResumeMatch(text);
    if (match) {
      earnedPoints += 1.0;
      matchedItems.push({
        requirement: text,
        importance: req.importance || "REQUIRED",
        matchType: "MATCHED",
        resumeEvidence: [match],
        jobEvidence: req.evidence || text,
        confidence: 0.9,
        relationship: req.relationship || "OPTIONAL",
      });
    } else {
      missingItems.push({
        requirement: text,
        importance: req.importance || "REQUIRED",
        matchType: "MISSING",
        resumeEvidence: [],
        jobEvidence: req.evidence || text,
        confidence: 1.0,
        relationship: req.relationship || "OPTIONAL",
        reason: "Not found in the resume",
      });
    }
  }

  const score = Math.min(
    100,
    Math.max(0, Math.round((earnedPoints / totalPoints) * 100)),
  );

  return {
    score,
    matchedItems,
    missingItems,
    partialItems,
    matchedCount: matchedItems.length,
    totalCount: totalItemsCount,
    details: `Demonstrates alignment with ${matchedItems.length} of ${totalItemsCount} core duties and requirements`,
  };
}
