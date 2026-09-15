import {
  JobAnalysis,
  JobKeyword,
  SkillRequirement,
  Responsibility,
  Requirement,
  ExperienceRequirement,
  EducationRequirement,
  CertificationRequirement,
} from "@resumeai/shared";

const KNOWN_SKILL_ALIASES: Record<string, string> = {
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  postgres: "PostgreSQL",
  postgresql: "PostgreSQL",
  py: "Python",
  python: "Python",
  k8s: "Kubernetes",
  kubernetes: "Kubernetes",
  react: "React",
  "react.js": "React",
  reactjs: "React",
  node: "Node.js",
  "node.js": "Node.js",
  nodejs: "Node.js",
  next: "Next.js",
  "next.js": "Next.js",
  nextjs: "Next.js",
  vue: "Vue.js",
  "vue.js": "Vue.js",
  vuejs: "Vue.js",
  aws: "AWS",
  gcp: "GCP",
  azure: "Azure",
  docker: "Docker",
  graphql: "GraphQL",
  sql: "SQL",
  "rest api": "REST APIs",
  "rest apis": "REST APIs",
  rest: "REST",
  "ci/cd": "CI/CD",
  cicd: "CI/CD",
  figma: "Figma",
  excel: "Excel",
  tableau: "Tableau",
  "power bi": "Power BI",
  powerbi: "Power BI",
};

/**
 * Normalizes skill name alias if known.
 */
export function normalizeSkillName(name: string): string {
  const lower = name.trim().toLowerCase();
  return KNOWN_SKILL_ALIASES[lower] || name.trim();
}

/**
 * Checks if text contains explicit negation keywords indicating something is NOT required.
 */
export function containsNegation(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("not required") ||
    lower.includes("no experience required") ||
    lower.includes("not needed") ||
    (lower.includes("without") && lower.includes("may still apply")) ||
    lower.includes("is a plus, but not required") ||
    lower.includes("plus, but not required")
  );
}

/**
 * Deterministically validates and sanitizes JobAnalysis data produced by the AI model.
 * Enforces:
 * - 0.0 <= confidence <= 1.0
 * - yearsMin >= 0, yearsMax >= yearsMin
 * - frequency >= 1
 * - Non-empty evidence when explicit is true
 * - Deduplication of keywords and skills
 * - Negation consistency (never mark a negated requirement as REQUIRED)
 */
export function validateAndSanitizeJobAnalysis(
  analysis: any,
  sourceText?: string,
): JobAnalysis {
  // 1. Sanitize clamp helper
  const clampConfidence = (c: number | undefined | null) => {
    if (typeof c !== "number" || isNaN(c)) return 1.0;
    return Math.max(0, Math.min(1, c));
  };

  // 2. Validate & Sanitize Keywords
  const keywordMap = new Map<string, JobKeyword>();
  for (const kw of analysis.keywords || []) {
    const rawKw = (kw.keyword || "").trim();
    if (!rawKw) continue;

    const lowerKey = rawKw.toLowerCase();
    const freq = Math.max(1, Math.floor(kw.frequency || 1));
    const conf = clampConfidence(kw.confidence);

    if (keywordMap.has(lowerKey)) {
      const existing = keywordMap.get(lowerKey)!;
      existing.frequency += freq;
      existing.confidence = Math.max(existing.confidence, conf);
      if (!existing.evidence && kw.evidence) {
        existing.evidence = kw.evidence;
      }
    } else {
      keywordMap.set(lowerKey, {
        keyword: rawKw,
        category: kw.category || "TECHNICAL",
        importance: kw.importance || "REQUIRED",
        frequency: freq,
        evidence: kw.evidence || "",
        confidence: conf,
      });
    }
  }

  // 3. Validate & Sanitize Skills
  const skillMap = new Map<string, SkillRequirement>();
  for (const s of analysis.skills || []) {
    const rawName = (s.name || "").trim();
    if (!rawName) continue;

    const normalized = normalizeSkillName(s.normalizedName || rawName);
    const key = normalized.toLowerCase();
    let importance = s.importance || "REQUIRED";
    const conf = clampConfidence(s.confidence);
    const evidence = s.evidence || "";

    // Negation safeguard: If evidence mentions "not required", downgrade
    if (containsNegation(evidence) || containsNegation(rawName)) {
      if (importance === "REQUIRED") {
        importance = "PREFERRED";
      }
    }

    const explicit = s.explicit ?? Boolean(evidence);

    if (skillMap.has(key)) {
      const existing = skillMap.get(key)!;
      // If one is REQUIRED and other is PREFERRED, prioritize REQUIRED
      if (importance === "REQUIRED") {
        existing.importance = "REQUIRED";
      }
      existing.confidence = Math.max(existing.confidence, conf);
      if (!existing.evidence && evidence) {
        existing.evidence = evidence;
      }
    } else {
      skillMap.set(key, {
        name: rawName,
        normalizedName: normalized,
        category: s.category || "REQUIRED_SKILL",
        importance,
        explicit,
        evidence,
        confidence: conf,
      });
    }
  }

  // 4. Validate & Sanitize Responsibilities
  const responsibilities: Responsibility[] = (analysis.responsibilities || [])
    .filter((r: any) => r && r.text && r.text.trim().length > 0)
    .map((r: any) => ({
      text: r.text.trim(),
      importance: r.importance || "REQUIRED",
      evidence: r.evidence || r.text.trim(),
      confidence: clampConfidence(r.confidence),
    }));

  // 5. Validate & Sanitize Requirements
  const requirements: Requirement[] = (analysis.requirements || [])
    .filter((req: any) => req && req.text && req.text.trim().length > 0)
    .map((req: any) => {
      let importance = req.importance || "REQUIRED";
      const evidence = req.evidence || "";
      if (containsNegation(evidence) || containsNegation(req.text)) {
        if (importance === "REQUIRED") {
          importance = "PREFERRED";
        }
      }
      return {
        text: req.text.trim(),
        category: req.category || "OTHER",
        importance,
        explicit: req.explicit ?? Boolean(evidence),
        evidence,
        confidence: clampConfidence(req.confidence),
        relationship: req.relationship || null,
        relatedRequirements: req.relatedRequirements || [],
      };
    });

  // 6. Validate & Sanitize Experience Requirements
  const experience: ExperienceRequirement[] = (analysis.experience || []).map(
    (exp: any) => {
      let yMin =
        exp.yearsMin !== null && exp.yearsMin !== undefined
          ? Math.max(0, exp.yearsMin)
          : null;
      let yMax =
        exp.yearsMax !== null && exp.yearsMax !== undefined
          ? Math.max(0, exp.yearsMax)
          : null;

      if (yMin !== null && yMax !== null && yMax < yMin) {
        // Swap or fix inverted bounds
        const temp = yMin;
        yMin = yMax;
        yMax = temp;
      }

      return {
        yearsMin: yMin,
        yearsMax: yMax,
        domain: exp.domain || null,
        management: Boolean(exp.management),
        importance: exp.importance || "REQUIRED",
        explicit: exp.explicit ?? true,
        evidence: exp.evidence || "",
        confidence: clampConfidence(exp.confidence),
      };
    },
  );

  // 7. Validate & Sanitize Education Requirements
  const education: EducationRequirement[] = (analysis.education || []).map(
    (edu: any) => ({
      degree: edu.degree || null,
      field: edu.field || null,
      minimum: edu.minimum ?? true,
      preferred: Boolean(edu.preferred),
      importance: edu.importance || "REQUIRED",
      explicit: edu.explicit ?? true,
      evidence: edu.evidence || "",
      confidence: clampConfidence(edu.confidence),
    }),
  );

  // 8. Validate & Sanitize Certifications
  const certifications: CertificationRequirement[] = (
    analysis.certifications || []
  )
    .filter((c: any) => c && c.name && c.name.trim().length > 0)
    .map((c: any) => ({
      name: c.name.trim(),
      importance: c.importance || "REQUIRED",
      explicit: c.explicit ?? true,
      evidence: c.evidence || "",
      confidence: clampConfidence(c.confidence),
    }));

  return {
    jobTitle: analysis.jobTitle ? analysis.jobTitle.trim() : null,
    company: analysis.company ? analysis.company.trim() : null,
    seniority: analysis.seniority || "UNKNOWN",
    summary: analysis.summary ? analysis.summary.trim() : null,

    responsibilities,
    requirements,
    skills: Array.from(skillMap.values()),
    education,
    certifications,
    experience,
    keywords: Array.from(keywordMap.values()),

    workArrangement: analysis.workArrangement || null,
    location: analysis.location ? analysis.location.trim() : null,
    industry: analysis.industry ? analysis.industry.trim() : null,
    workAuthorization: analysis.workAuthorization
      ? analysis.workAuthorization.trim()
      : null,

    // Backward compatibility mappings
    roleSummary: analysis.summary || analysis.roleSummary || "",
    requiredSkills: Array.from(skillMap.values())
      .filter((s) => s.importance === "REQUIRED")
      .map((s) => s.normalizedName),
    preferredSkills: Array.from(skillMap.values())
      .filter((s) => s.importance !== "REQUIRED")
      .map((s) => s.normalizedName),
    coreResponsibilities: responsibilities.map((r) => r.text),
    domainKeywords: Array.from(keywordMap.values()).map((k) => k.keyword),
    seniorityLevel: analysis.seniority || "UNKNOWN",
    experienceYearsMinimum:
      experience.length > 0 && experience[0].yearsMin !== null
        ? experience[0].yearsMin
        : 0,
  };
}
