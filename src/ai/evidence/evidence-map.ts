import { ResumeData } from "@resumeai/shared";

export interface EvidenceMap {
  technologies: Set<string>;
  databases: Set<string>;
  frameworks: Set<string>;
  employers: Set<string>;
  titles: Set<string>;
  dates: Set<string>;
  metrics: Set<string>;
  projects: Set<string>;
  certifications: Set<string>;
  fieldEvidenceIds: Map<string, string>;
  rawEvidenceSnippets: Map<string, string>;
}

// Known common databases for categorization
const KNOWN_DATABASES = new Set([
  "postgresql",
  "postgres",
  "mongodb",
  "sqlite",
  "mysql",
  "redis",
  "dynamodb",
  "cassandra",
  "elasticsearch",
  "oracle",
  "mariadb",
  "neo4j",
  "couchdb",
  "firestore",
  "supabase",
  "cockroachdb",
]);

// Known common frameworks / libraries for categorization
const KNOWN_FRAMEWORKS = new Set([
  "react",
  "react.js",
  "reactjs",
  "react native",
  "next.js",
  "nextjs",
  "vue",
  "vue.js",
  "angular",
  "angularjs",
  "svelte",
  "node.js",
  "nodejs",
  "express",
  "express.js",
  "fastapi",
  "flask",
  "django",
  "spring",
  "spring boot",
  "asp.net",
  ".net",
  "laravel",
  "rails",
  "ruby on rails",
  "scikit-learn",
  "sklearn",
  "tensorflow",
  "pytorch",
  "keras",
  "pandas",
  "numpy",
  "tailwind",
  "tailwindcss",
  "bootstrap",
  "graphql",
  "trpc",
]);

/**
 * Normalizes a term: trims, lowercases, removes redundant punctuation
 */
export function normalizeEvidenceTerm(term: string): string {
  return term
    .trim()
    .toLowerCase()
    .replace(/[;,.()\[\]]/g, "");
}

/**
 * Extracts metrics (percentages, numbers, scale) from text
 */
export function extractMetricsFromText(text: string): string[] {
  if (!text) return [];
  const metrics: string[] = [];

  // Percentages: e.g. 92%, 40.5%
  const percentRegex = /\b\d+(?:\.\d+)?%/g;
  let match: RegExpExecArray | null;
  while ((match = percentRegex.exec(text)) !== null) {
    metrics.push(match[0].toLowerCase());
  }

  // Scale numbers with k/m/b: e.g. 10k+, 2m+, $50m
  const scaleRegex =
    /(?:\$?\b\d+(?:\.\d+)?[kKmMbB]\+?|\$\d+(?:,\d{3})*(?:\.\d+)?)/g;
  while ((match = scaleRegex.exec(text)) !== null) {
    metrics.push(match[0].toLowerCase());
  }

  // Large numbers with commas: e.g. 10,000+, 2,000,000
  const largeNumRegex = /\b\d{1,3}(?:,\d{3})+\+?\b/g;
  while ((match = largeNumRegex.exec(text)) !== null) {
    metrics.push(match[0].toLowerCase());
  }

  // P99 / P95 Latency
  const latencyRegex = /\bp\d+\s+latency\b/gi;
  while ((match = latencyRegex.exec(text)) !== null) {
    metrics.push(match[0].toLowerCase());
  }

  return metrics;
}

/**
 * Builds a normalized, immutable EvidenceMap from authoritative ResumeData
 */
export function buildEvidenceMap(resumeData: ResumeData): EvidenceMap {
  const technologies = new Set<string>();
  const databases = new Set<string>();
  const frameworks = new Set<string>();
  const employers = new Set<string>();
  const titles = new Set<string>();
  const dates = new Set<string>();
  const metrics = new Set<string>();
  const projects = new Set<string>();
  const certifications = new Set<string>();
  const fieldEvidenceIds = new Map<string, string>();
  const rawEvidenceSnippets = new Map<string, string>();

  const registerTech = (term: string) => {
    if (!term) return;
    const clean = normalizeEvidenceTerm(term);
    if (!clean || clean.length < 2) return;
    technologies.add(clean);
    if (clean.startsWith("aws ") && clean.length > 4) {
      technologies.add(clean.replace(/^aws\s+/i, ""));
    }
    if (KNOWN_DATABASES.has(clean)) databases.add(clean);
    if (KNOWN_FRAMEWORKS.has(clean)) frameworks.add(clean);
  };

  // 1. Personal Info
  if (resumeData.personalInfo?.headline) {
    titles.add(normalizeEvidenceTerm(resumeData.personalInfo.headline));
    rawEvidenceSnippets.set("headline", resumeData.personalInfo.headline);
  }

  // 2. Summary
  if (resumeData.summary) {
    rawEvidenceSnippets.set("summary", resumeData.summary);
    for (const m of extractMetricsFromText(resumeData.summary)) metrics.add(m);
  }

  // 3. Work Experience
  for (const [expIdx, exp] of (resumeData.experience || []).entries()) {
    const expId = exp.id || `experience-${expIdx + 1}`;

    if (exp.company) {
      employers.add(normalizeEvidenceTerm(exp.company));
      rawEvidenceSnippets.set(`${expId}-company`, exp.company);
    }
    if (exp.jobTitle || exp.position) {
      const title = exp.jobTitle || exp.position || "";
      titles.add(normalizeEvidenceTerm(title));
      rawEvidenceSnippets.set(`${expId}-title`, title);
    }
    if (exp.startDate) dates.add(normalizeEvidenceTerm(exp.startDate));
    if (exp.endDate) dates.add(normalizeEvidenceTerm(exp.endDate));

    for (const tech of exp.technologiesUsed || []) {
      registerTech(tech);
    }

    for (const [bulletIdx, bullet] of (exp.bullets || []).entries()) {
      const bulletEvidenceId = `${expId}-bullet-${bulletIdx + 1}`;
      fieldEvidenceIds.set(
        `experience.${expId}.bullets[${bulletIdx}]`,
        bulletEvidenceId,
      );
      fieldEvidenceIds.set(
        `experience.${expId}.bullets.${bulletIdx}`,
        bulletEvidenceId,
      );
      rawEvidenceSnippets.set(bulletEvidenceId, bullet);

      for (const m of extractMetricsFromText(bullet)) metrics.add(m);
    }
  }

  // 4. Projects
  for (const [projIdx, proj] of (resumeData.projects || []).entries()) {
    const projId = proj.id || `project-${projIdx + 1}`;
    if (proj.name) {
      projects.add(normalizeEvidenceTerm(proj.name));
      rawEvidenceSnippets.set(`${projId}-name`, proj.name);
    }
    if (proj.role) {
      titles.add(normalizeEvidenceTerm(proj.role));
    }
    const projTechs = (proj as any).technologiesUsed || proj.technologies || [];
    for (const tech of projTechs) {
      registerTech(tech);
    }

    if (proj.description) {
      rawEvidenceSnippets.set(`${projId}-description`, proj.description);
      for (const m of extractMetricsFromText(proj.description)) metrics.add(m);
    }

    for (const [bulletIdx, bullet] of (proj.bullets || []).entries()) {
      const bulletEvidenceId = `${projId}-bullet-${bulletIdx + 1}`;
      fieldEvidenceIds.set(
        `projects.${projId}.bullets[${bulletIdx}]`,
        bulletEvidenceId,
      );
      fieldEvidenceIds.set(
        `projects.${projId}.bullets.${bulletIdx}`,
        bulletEvidenceId,
      );
      rawEvidenceSnippets.set(bulletEvidenceId, bullet);

      for (const m of extractMetricsFromText(bullet)) metrics.add(m);
    }
  }

  // 5. Skills
  for (const [sIdx, sGroup] of (resumeData.skills || []).entries()) {
    const groupId = sGroup.id || `skills-${sIdx + 1}`;
    fieldEvidenceIds.set(`skills.${groupId}`, groupId);
    if (sGroup.category) {
      rawEvidenceSnippets.set(`${groupId}-category`, sGroup.category);
    }
    for (const skill of sGroup.skills || []) {
      registerTech(skill);
      // Also split composite skills like "Node.js/Express.js" or "PostgreSQL, Redis"
      skill.split(/[/,]/).forEach((sub) => registerTech(sub));
    }
  }

  // 6. Certifications
  for (const [cIdx, cert] of (resumeData.certifications || []).entries()) {
    const certId = cert.id || `certification-${cIdx + 1}`;
    if (cert.name) {
      certifications.add(normalizeEvidenceTerm(cert.name));
      rawEvidenceSnippets.set(certId, cert.name);
    }
  }

  return {
    technologies,
    databases,
    frameworks,
    employers,
    titles,
    dates,
    metrics,
    projects,
    certifications,
    fieldEvidenceIds,
    rawEvidenceSnippets,
  };
}

/**
 * Checks if a technology, database, framework, tool, or term is supported by the EvidenceMap.
 * Uses strict word-boundary matching without false-positive substrings.
 */
export function isTechnologySupported(
  term: string,
  evidenceMap: EvidenceMap,
  fullResumeRawText: string,
): boolean {
  const clean = normalizeEvidenceTerm(term);
  if (!clean || clean.length < 2) return false;

  // Direct set check
  if (
    evidenceMap.technologies.has(clean) ||
    evidenceMap.databases.has(clean) ||
    evidenceMap.frameworks.has(clean)
  ) {
    return true;
  }

  // Closed-world policy: technology evidence must come from the structured
  // inventory (skills, technologiesUsed, project technologies) built into the
  // sets above. Free-text mentions anywhere in the resume JSON must NOT
  // whitelist a technology (e.g. "Django" appearing in a course description
  // or an earlier AI-applied summary must not make Django a supported skill).
  return false;
}
