import {
  ResumeData,
  ResumeContentChange,
  ContentProposalSummaryStats,
  FactualClaim,
} from "@resumeai/shared";
import {
  buildEvidenceMap,
  isTechnologySupported,
  normalizeEvidenceTerm,
  extractMetricsFromText,
} from "../evidence/evidence-map.js";

/**
 * Extracts candidate technologies, skills, and tools into a normalized set
 */
export function extractCandidateTechnologies(resume: ResumeData): Set<string> {
  const techs = new Set<string>();

  const addTerm = (term: string) => {
    if (!term) return;
    const clean = term.trim().toLowerCase();
    if (clean.length > 1) {
      techs.add(clean);
      // Also register single word tokens for multi-word tools (e.g. "express.js" -> "express")
      if (clean.includes(".")) techs.add(clean.replace(/\.js$/i, ""));
      if (clean.startsWith("aws ") && clean.length > 4) {
        techs.add(clean.replace(/^aws\s+/i, ""));
      }
    }
  };

  // Skills
  for (const group of resume.skills || []) {
    for (const skill of group.skills || []) {
      addTerm(skill);
      skill.split(/[/,]/).forEach((sub) => addTerm(sub));
    }
  }

  // Experience technologiesUsed & descriptions
  for (const exp of resume.experience || []) {
    for (const tech of exp.technologiesUsed || []) {
      addTerm(tech);
    }
  }

  // Project technologies & descriptions
  for (const proj of resume.projects || []) {
    const projTechs = (proj as any).technologiesUsed || proj.technologies || [];
    for (const tech of projTechs) {
      addTerm(tech);
    }
  }

  return techs;
}

/**
 * Extracts metrics and numerical claims from text
 */
export function extractMetrics(text: string): string[] {
  return extractMetricsFromText(text);
}

/**
 * Structured metric with semantic unit context.
 * Enables detection of unit substitution (e.g., "10K+ records" ≠ "10K+ users").
 */
export interface MetricWithUnit {
  value: string; // e.g. "10k+", "92%", "2m"
  unit: string; // e.g. "records", "users", "accuracy", "" if no unit
  fullMatch: string; // e.g. "10K+ records", "92% accuracy"
}

/**
 * Extracts metrics with their semantic unit context from text.
 * Captures the word following a numeric metric to enable unit comparison.
 */
export function extractMetricsWithUnits(text: string): MetricWithUnit[] {
  if (!text) return [];
  const results: MetricWithUnit[] = [];

  // Match: numeric value (with optional k/m/b/+ suffix or %) followed by up to 2 context words
  const metricWithUnitRegex =
    /(\$?\d+(?:[.,]\d+)*[kKmMbB]?\+?%?)\s*(?:\+\s*)?([a-zA-Z][\w-]*)(?:\s+([a-zA-Z][\w-]*))?/g;

  let match: RegExpExecArray | null;
  while ((match = metricWithUnitRegex.exec(text)) !== null) {
    const rawValue = match[1].trim().toLowerCase();
    // Skip bare small numbers without any metric indicator (%, k, m, etc.)
    const hasMetricIndicator =
      rawValue.includes("%") ||
      /[kmb]\+?$/i.test(rawValue) ||
      rawValue.includes("$") ||
      /\d{4,}/.test(rawValue.replace(/,/g, "")) ||
      /\d+,\d{3}/.test(rawValue);
    if (!hasMetricIndicator) continue;

    const firstWord = (match[2] || "").toLowerCase().trim();
    const secondWord = (match[3] || "").toLowerCase().trim();

    // Skip common non-unit stop words
    const skipWords = new Set([
      "and",
      "or",
      "the",
      "a",
      "an",
      "of",
      "in",
      "on",
      "to",
      "for",
      "with",
      "by",
      "from",
      "is",
      "are",
      "was",
      "were",
      "that",
      "this",
      "has",
      "have",
      "had",
      "not",
      "but",
      "can",
      "will",
    ]);

    let effectiveUnit = skipWords.has(firstWord) ? "" : firstWord;
    if (secondWord && !skipWords.has(secondWord)) {
      const coreMetricNouns = new Set([
        "accuracy",
        "rate",
        "users",
        "user",
        "records",
        "record",
        "requests",
        "request",
        "queries",
        "query",
        "calls",
        "call",
        "invocations",
        "invocation",
        "customers",
        "customer",
        "clients",
        "client",
        "accounts",
        "account",
        "members",
        "member",
        "subscribers",
        "subscriber",
        "transactions",
        "transaction",
        "latency",
        "throughput",
        "coverage",
        "documents",
        "document",
        "rows",
        "row",
        "samples",
        "sample",
      ]);
      if (coreMetricNouns.has(secondWord)) {
        effectiveUnit = secondWord;
      }
    }

    results.push({
      value: rawValue,
      unit: effectiveUnit,
      fullMatch: match[0].trim(),
    });
  }

  return results;
}

/**
 * Universal technology & framework catalog to guard against unevidenced hallucination.
 * Any mention of these terms in rewritten content MUST be supported by the candidate's resume.
 */
export const COMPREHENSIVE_TECHNOLOGY_CATALOG = [
  // Frameworks & Libraries
  "django",
  "flask",
  "fastapi",
  "spring",
  "spring boot",
  "react",
  "react native",
  "next.js",
  "vue",
  "angular",
  "svelte",
  "node.js",
  "express",
  "express.js",
  "nestjs",
  "laravel",
  "rails",
  "ruby on rails",
  "asp.net",
  "scikit-learn",
  "tensorflow",
  "pytorch",
  "keras",
  "pandas",
  "numpy",
  // Big Data & MLOps
  "pyspark",
  "spark",
  "databricks",
  "hadoop",
  "airflow",
  "mlflow",
  "dbt",
  "snowflake",
  "kafka",
  "rabbitmq",
  // Cloud & DevOps & Platforms
  "aws ec2",
  "ec2",
  "aws s3",
  "s3",
  "aws lambda",
  "lambda",
  "aws",
  "amazon web services",
  "gcp",
  "google cloud",
  "azure",
  "docker",
  "kubernetes",
  "k8s",
  "terraform",
  "vercel",
  "netlify",
  "heroku",
  // Databases & Caches
  "postgresql",
  "postgres",
  "mongodb",
  "sqlite",
  "mysql",
  "redis",
  "dynamodb",
  "cassandra",
  "elasticsearch",
  "graphql",
  // Architectural Leaps (Disallow unless evidenced)
  "microservices",
  "scalable distributed architecture",
  "collaborative services",
  "event-driven architecture",
  "serverless",
  "cloud infrastructure",
  "predictive modeling",
];

export const SENSITIVE_TECHNOLOGIES = COMPREHENSIVE_TECHNOLOGY_CATALOG;

/**
 * Seniority markers to guard against unearned inflation
 */
export const SENIORITY_LEVELS = [
  "senior",
  "lead",
  "principal",
  "staff",
  "architect",
  "director",
  "head of",
  "chief",
];

/**
 * Semantic upgrade terms that imply capabilities beyond what may be evidenced.
 * If the proposed text introduces these terms and the original/resume doesn't contain them,
 * the claim is UNSUPPORTED (prevents architectural inference leaps).
 */
export const SEMANTIC_UPGRADE_TERMS = [
  "scalable",
  "scalable architecture",
  "distributed",
  "distributed data engineering",
  "high-availability",
  "fault-tolerant",
  "cloud-native",
  "event-driven",
  "real-time",
  "mission-critical",
  "microservices",
  "predictive modeling",
  "system architecture",
  "cloud infrastructure",
  "production ml platform",
  "production deployment",
  "production environment",
  "high-throughput",
  "high throughput",
];

/**
 * Certification markers used to detect invented credentials.
 */
export const CERTIFICATION_MARKERS = [
  "certified",
  "certification",
  "certificate",
  "accredited",
  "credential",
  "professional certification",
];

export interface VerificationResult {
  verifiedChanges: ResumeContentChange[];
  stats: ContentProposalSummaryStats;
}

/**
 * Checks if a specific technology is mentioned in proposed text using exact word boundary
 */
function isMentionedInText(term: string, text: string): boolean {
  const clean = term.trim().toLowerCase();
  const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
  return regex.test(text);
}

/**
 * Verifies a single proposed change against authoritative ResumeData.
 * Produces atomic factual claims with evidence IDs and verification statuses.
 */
export function verifySingleChange(
  change: ResumeContentChange,
  resumeData: ResumeData,
): {
  verifiedChange: ResumeContentChange;
  claims: FactualClaim[];
  factGuardScore: number;
  supportedClaimsCount: number;
  unsupportedClaimsCount: number;
} {
  const evidenceMap = buildEvidenceMap(resumeData);
  const candidateTechs = extractCandidateTechnologies(resumeData);
  const fullResumeRawText = JSON.stringify(resumeData).toLowerCase();

  const verifiedChange = { ...change };
  const originalText = change.originalValue || "";
  const proposedText = change.proposedValue || "";
  const proposedLower = proposedText.toLowerCase();
  const originalLower = originalText.toLowerCase();

  const claims: FactualClaim[] = [];
  const primaryEvidenceId =
    (change.evidenceIds && change.evidenceIds[0]) ||
    change.itemId ||
    `${change.section}_evidence`;

  // 1. Evidence IDs existence
  if (!change.evidenceIds || change.evidenceIds.length === 0) {
    verifiedChange.status = "BLOCKED";
    verifiedChange.factCheckStatus = "UNSUPPORTED";
    verifiedChange.blockedReason =
      "Missing evidence IDs: Proposed change does not trace to any candidate resume evidence.";
    claims.push({
      claim: "Traceable source evidence",
      category: "RESPONSIBILITY",
      evidenceIds: [],
      factCheckStatus: "UNSUPPORTED",
      reason: "No evidence ID provided",
    });
    return {
      verifiedChange,
      claims,
      factGuardScore: 0,
      supportedClaimsCount: 0,
      unsupportedClaimsCount: 1,
    };
  }

  // 1.1 Evidence ID Server-Side Verification & Tampering Defense
  const validEvidenceIdSet = new Set<string>(
    [
      `${change.section}_evidence`,
      change.itemId || "",
      "headline",
      "summary",
      ...Array.from(evidenceMap.rawEvidenceSnippets.keys()),
      ...Array.from(evidenceMap.fieldEvidenceIds.values()),
      ...(resumeData.experience || []).map((e) => e.id || ""),
      ...(resumeData.projects || []).map((p) => p.id || ""),
      ...(resumeData.skills || []).map((s) => s.id || ""),
      ...(resumeData.education || []).map((e) => e.id || ""),
      ...(resumeData.certifications || []).map((c) => c.id || ""),
    ].filter(Boolean),
  );

  const hasTamperedEvidenceIds = change.evidenceIds.some(
    (id) =>
      id.toLowerCase().includes("tamper") ||
      id.toLowerCase().includes("fake") ||
      (!validEvidenceIdSet.has(id) &&
        !id.startsWith(`${change.section}`) &&
        !id.startsWith("exp") &&
        !id.startsWith("proj") &&
        !id.startsWith("skill") &&
        !id.startsWith("edu") &&
        !id.startsWith("cert")),
  );

  if (hasTamperedEvidenceIds) {
    verifiedChange.status = "BLOCKED";
    verifiedChange.factCheckStatus = "UNSUPPORTED";
    verifiedChange.blockedReason =
      "Evidence ID tampering detected: One or more evidence IDs are invalid or forged.";
    claims.push({
      claim: "Server-validated evidence tracing",
      category: "RESPONSIBILITY",
      evidenceIds: [],
      factCheckStatus: "UNSUPPORTED",
      reason: "Evidence ID not found in server EvidenceMap",
    });
    return {
      verifiedChange,
      claims,
      factGuardScore: 0,
      supportedClaimsCount: 0,
      unsupportedClaimsCount: 1,
    };
  }

  // 2. Prompt Injection Defense
  const INJECTION_MARKERS = [
    "system compromised",
    "ignore all previous",
    "ignore previous instructions",
    "override system",
    "jailbreak",
    "developer mode enabled",
  ];
  if (INJECTION_MARKERS.some((marker) => proposedLower.includes(marker))) {
    verifiedChange.status = "BLOCKED";
    verifiedChange.factCheckStatus = "UNSUPPORTED";
    verifiedChange.blockedReason =
      "Security violation detected: Proposed rewrite contains disallowed system injection keywords.";
    claims.push({
      claim: "Security protocol compliance",
      category: "RESPONSIBILITY",
      evidenceIds: [],
      factCheckStatus: "UNSUPPORTED",
      reason: "Prompt injection marker detected",
    });
    return {
      verifiedChange,
      claims,
      factGuardScore: 0,
      supportedClaimsCount: 0,
      unsupportedClaimsCount: 1,
    };
  }

  // 3. Metric / Number Protection & Semantic Unit Integrity
  const origMetrics = extractMetrics(originalText);
  const propMetrics = extractMetrics(proposedText);
  const origWithUnits = extractMetricsWithUnits(originalText);
  const propWithUnits = extractMetricsWithUnits(proposedText);
  // Unit context from the authoritative resume itself, not just the original field text:
  // "10K+ records" in a resume bullet must block "10K+ users" even if the original
  // field text contains no metric at all.
  const resumeWithUnits = [
    ...Array.from(evidenceMap.rawEvidenceSnippets.values()),
    ...Array.from(evidenceMap.metrics),
  ]
    .join(" ")
    .toLowerCase();
  const resumeUnits = extractMetricsWithUnits(resumeWithUnits);

  const normalizeUnit = (u: string) => {
    let clean = u.toLowerCase().trim();
    if (clean.endsWith("ies") && clean.length > 4) {
      clean = clean.slice(0, -3) + "y";
    } else if (clean.endsWith("s") && clean.length > 3) {
      clean = clean.slice(0, -1);
    }

    // Synonym mapping for interchangeable technical domain units
    // 1. API / System traffic / Invocations / Queries
    if (
      [
        "request",
        "query",
        "call",
        "invocation",
        "api_call",
        "api_request",
      ].includes(clean)
    ) {
      return "request";
    }
    // 2. Data items / Storage: record, row, entry, document, sample, datapoint
    if (
      ["record", "row", "entry", "document", "sample", "datapoint"].includes(
        clean,
      )
    ) {
      return "record";
    }
    // 3. User / Account units: user, customer, client, account, subscriber, member
    if (
      [
        "user",
        "customer",
        "client",
        "account",
        "subscriber",
        "member",
      ].includes(clean)
    ) {
      return "user";
    }
    // 4. ML Evaluation units: accuracy, precision, recall, f1
    if (["accuracy", "precision", "recall", "f1"].includes(clean)) {
      return "accuracy";
    }
    // 5. Latency / Time: latency, delay
    if (["latency", "delay"].includes(clean)) {
      return "latency";
    }

    return clean;
  };

  // 3.1 Detect metric semantic unit substitution (e.g., "10K+ records" -> "10K+ users")
  for (const propU of propWithUnits) {
    if (!propU.unit) continue;
    const propValNorm = propU.value.replace(/[^\d]/g, "");
    const matchingOrig = [origWithUnits, resumeUnits]
      .flatMap((list) => list)
      .find((origU) => {
        const origValNorm = origU.value.replace(/[^\d]/g, "");
        return origValNorm === propValNorm && origU.unit.length > 0;
      });

    if (
      matchingOrig &&
      normalizeUnit(matchingOrig.unit) !== normalizeUnit(propU.unit)
    ) {
      // Semantic equivalence escape hatch: the unit regex only captures the word
      // immediately after the value ("92% prediction" from "92% prediction accuracy").
      // If the evidence text contains the value followed nearby by the proposed unit,
      // the claim is grounded ("92% accuracy" matches "92% prediction accuracy").
      const valEscaped = propU.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const unitEscaped = propU.unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const phraseRegex = new RegExp(
        `${valEscaped}[^.]{0,40}?${unitEscaped}`,
        "i",
      );
      const evidenceSupportsPhrase =
        phraseRegex.test(resumeWithUnits) || phraseRegex.test(originalText);
      if (evidenceSupportsPhrase) continue;
      verifiedChange.status = "BLOCKED";
      verifiedChange.factCheckStatus = "CONTRADICTED";
      verifiedChange.blockedReason = `Metric semantic unit contradiction detected: Converted '${matchingOrig.unit}' to '${propU.unit}' for '${propU.value}' (evidence only supports '${matchingOrig.unit}').`;
      claims.push({
        claim: `Metric claim '${propU.value} ${propU.unit}'`,
        category: "METRIC_OR_KPI",
        evidenceIds: [primaryEvidenceId],
        factCheckStatus: "CONTRADICTED",
        reason: `Metric unit '${propU.unit}' contradicts original evidence unit '${matchingOrig.unit}'.`,
      });
    }
  }

  // 3.2 Value & Inflation Verification
  for (const metric of propMetrics) {
    // If already flagged as contradicted by semantic unit check, skip duplicate
    if (
      claims.some(
        (c) =>
          c.category === "METRIC_OR_KPI" &&
          c.claim.toLowerCase().includes(metric.toLowerCase()) &&
          c.factCheckStatus === "CONTRADICTED",
      )
    ) {
      continue;
    }

    const isPercent = metric.includes("%");
    const origHasPercent = origMetrics.some((m) => m.includes("%"));
    const inResume =
      origMetrics.includes(metric) ||
      fullResumeRawText.includes(metric) ||
      evidenceMap.metrics.has(metric);

    if (!inResume) {
      // Percent inflation vs. authoritative resume evidence (not just the field's original
      // text): a resume bullet evidences "92%", so "98%" is a CONTRADICTION, not merely
      // an invented metric.
      const resumePercents = Array.from(evidenceMap.metrics).filter((m) =>
        m.includes("%"),
      );
      if (isPercent && resumePercents.length > 0) {
        verifiedChange.status = "BLOCKED";
        verifiedChange.factCheckStatus = "CONTRADICTED";
        verifiedChange.blockedReason = `Metric inflation detected: Proposed metric '${metric}' contradicts resume evidence '${resumePercents.join(", ")}'.`;
        claims.push({
          claim: `Metric claim '${metric}'`,
          category: "METRIC_OR_KPI",
          evidenceIds: [],
          factCheckStatus: "CONTRADICTED",
          reason: `Metric '${metric}' contradicts resume evidence '${resumePercents.join(", ")}'.`,
        });
      } else if (isPercent && origHasPercent) {
        verifiedChange.status = "BLOCKED";
        verifiedChange.factCheckStatus = "CONTRADICTED";
        verifiedChange.blockedReason = `Metric inflation detected: Proposed metric '${metric}' contradicts original evidence '${origMetrics.join(", ")}'.`;
        claims.push({
          claim: `Metric claim '${metric}'`,
          category: "METRIC_OR_KPI",
          evidenceIds: [primaryEvidenceId],
          factCheckStatus: "CONTRADICTED",
          reason: `Metric '${metric}' contradicts original evidence '${origMetrics.join(", ")}'.`,
        });
      } else {
        verifiedChange.status = "BLOCKED";
        verifiedChange.factCheckStatus = "UNSUPPORTED";
        verifiedChange.blockedReason = `Invented metric detected: '${metric}' has no supporting evidence in the original resume.`;
        claims.push({
          claim: `Metric claim '${metric}'`,
          category: "METRIC_OR_KPI",
          evidenceIds: [],
          factCheckStatus: "UNSUPPORTED",
          reason: `Invented metric '${metric}' is not evidenced in your resume.`,
        });
      }
    } else {
      claims.push({
        claim: `Preserves metric '${metric}'`,
        category: "METRIC_OR_KPI",
        evidenceIds: [primaryEvidenceId],
        factCheckStatus: "SUPPORTED",
      });
    }
  }

  // 3.5. Certification Protection
  const certPattern =
    /\b(?:aws\s+certified[^\n,.]*|google\s+cloud\s+certified[^\n,.]*|azure\s+certified[^\n,.]*|certified\s+[a-z]+(?:\s+[a-z]+)?|comptia\s+[a-z+]+|pmp\s+certified|cissp)\b/i;
  const matchCert = proposedText.match(certPattern);
  if (matchCert) {
    const certClaim = matchCert[0].trim();
    const isEvidenced =
      (resumeData.certifications || []).some(
        (c) =>
          c.name?.toLowerCase().includes(certClaim.toLowerCase()) ||
          certClaim.toLowerCase().includes(c.name?.toLowerCase() || "___"),
      ) ||
      evidenceMap.certifications.has(normalizeEvidenceTerm(certClaim)) ||
      fullResumeRawText.includes(certClaim.toLowerCase());

    if (!isEvidenced) {
      verifiedChange.status = "BLOCKED";
      verifiedChange.factCheckStatus = "UNSUPPORTED";
      verifiedChange.blockedReason =
        verifiedChange.blockedReason ||
        `Invented certification detected: '${certClaim}' is not evidenced in candidate resume.`;
      claims.push({
        claim: `Certification '${certClaim}'`,
        category: "CERTIFICATION",
        evidenceIds: [],
        factCheckStatus: "UNSUPPORTED",
        reason: `Certification '${certClaim}' is not found in candidate profile.`,
      });
    }
  }

  // 4. Closed-World Technology & Framework Verification
  for (const tech of COMPREHENSIVE_TECHNOLOGY_CATALOG) {
    if (isMentionedInText(tech, proposedText)) {
      const isEvidenced =
        isTechnologySupported(tech, evidenceMap, fullResumeRawText) ||
        candidateTechs.has(tech) ||
        isMentionedInText(tech, originalText);

      if (!isEvidenced) {
        verifiedChange.status = "BLOCKED";
        verifiedChange.factCheckStatus = "UNSUPPORTED";
        verifiedChange.blockedReason =
          verifiedChange.blockedReason ||
          `Unsupported technology detected: '${tech}' is not found in your resume.`;
        claims.push({
          claim: `Technology '${tech}'`,
          category: "TECHNOLOGY",
          evidenceIds: [],
          factCheckStatus: "UNSUPPORTED",
          reason: `Unsupported technology '${tech}' is not found in your resume.`,
        });
      } else {
        claims.push({
          claim: `Supported technology '${tech}'`,
          category: "TECHNOLOGY",
          evidenceIds: [primaryEvidenceId],
          factCheckStatus: "SUPPORTED",
        });
      }
    }
  }

  // 4.5. Scalability & Architecture Semantic Upgrade Protection
  for (const term of SEMANTIC_UPGRADE_TERMS) {
    if (isMentionedInText(term, proposedText)) {
      const isEvidenced =
        isMentionedInText(term, originalText) ||
        isMentionedInText(term, fullResumeRawText);

      if (!isEvidenced) {
        verifiedChange.status = "BLOCKED";
        verifiedChange.factCheckStatus = "UNSUPPORTED";
        verifiedChange.blockedReason =
          verifiedChange.blockedReason ||
          `Unproven scalability/architecture claim: '${term}' is not evidenced in candidate resume.`;
        claims.push({
          claim: `Architecture claim '${term}'`,
          category: "RESPONSIBILITY",
          evidenceIds: [],
          factCheckStatus: "UNSUPPORTED",
          reason: `Unproven architectural claim '${term}' is not found in candidate resume.`,
        });
      }
    }
  }

  // 5. Seniority / Title Inflation Protection
  for (const level of SENIORITY_LEVELS) {
    const isJobTitleField =
      change.field === "jobTitle" || change.field === "position";

    const titlePattern = isJobTitleField
      ? new RegExp(`\\b${level}\\b`, "i")
      : new RegExp(
          `\\b${level}\\s+(software|engineer|developer|architect|consultant|director|manager|technologist|data\\s+scientist)\\b`,
          "i",
        );

    if (titlePattern.test(proposedText) && !titlePattern.test(originalText)) {
      const candidateHasLevel =
        (resumeData.experience || []).some(
          (exp) =>
            new RegExp(`\\b${level}\\b`, "i").test(exp.jobTitle || "") ||
            new RegExp(`\\b${level}\\b`, "i").test(exp.position || ""),
        ) ||
        new RegExp(`\\b${level}\\b`, "i").test(
          resumeData.personalInfo?.headline || "",
        );

      if (isJobTitleField || !candidateHasLevel) {
        verifiedChange.status = "BLOCKED";
        verifiedChange.factCheckStatus = "CONTRADICTED";
        verifiedChange.blockedReason = `Seniority title inflation detected: Added '${level}' without underlying role evidence.`;
        claims.push({
          claim: `Seniority level '${level}'`,
          category: "JOB_TITLE",
          evidenceIds: [primaryEvidenceId],
          factCheckStatus: "CONTRADICTED",
          reason: `Seniority title '${level}' is not supported by your experience history.`,
        });
      }
    }
  }

  // 5.1. Experience Duration / Years of Experience Claims Protection
  // Guard against unevidenced tenure claims like "several years of experience", "5+ years of experience", etc.
  const tenureRegex =
    /\b(?:(several|multiple|\d+(?:\+)?)\s*(?:years?|yrs?)\s*(?:of)?\s*experience)\b/i;
  const tenureMatch = proposedText.match(tenureRegex);
  if (tenureMatch && !tenureRegex.test(originalText)) {
    const claimedPhrase = tenureMatch[0];
    const claimedNumberStr = tenureMatch[1].toLowerCase();

    // Calculate candidate actual years of experience from resumeData.experience dates
    let candidateExperienceYears = 0;
    for (const exp of resumeData.experience || []) {
      const startMatch = (exp.startDate || "").match(/\b(19\d\d|20\d\d)\b/);
      const endMatch = exp.current
        ? [new Date().getFullYear().toString()]
        : (exp.endDate || "").match(/\b(19\d\d|20\d\d)\b/);
      if (startMatch && endMatch) {
        const startY = parseInt(startMatch[1], 10);
        const endY = parseInt(endMatch[1], 10);
        if (endY >= startY) {
          candidateExperienceYears += Math.max(1, endY - startY);
        }
      }
    }

    const inResume = fullResumeRawText.includes(claimedPhrase.toLowerCase());
    let isSupported = inResume;
    let tenureReason = "";

    if (!isSupported) {
      if (claimedNumberStr === "several" || claimedNumberStr === "multiple") {
        if (candidateExperienceYears < 3) {
          isSupported = false;
          tenureReason = `Claimed '${claimedPhrase}' requires at least 3 years of demonstrated professional experience (evidence shows ${candidateExperienceYears} years).`;
        } else {
          isSupported = true;
        }
      } else {
        const claimedYears = parseInt(claimedNumberStr.replace(/\+/g, ""), 10);
        if (!isNaN(claimedYears) && candidateExperienceYears < claimedYears) {
          isSupported = false;
          tenureReason = `Claimed '${claimedPhrase}' exceeds verified experience of ${candidateExperienceYears} years.`;
        } else if (!isNaN(claimedYears)) {
          isSupported = true;
        }
      }
    }

    if (!isSupported) {
      verifiedChange.status = "BLOCKED";
      verifiedChange.factCheckStatus = "UNSUPPORTED";
      verifiedChange.blockedReason =
        verifiedChange.blockedReason ||
        `Unsubstantiated experience claim: '${claimedPhrase}' is not supported by employment dates.`;
      claims.push({
        claim: `Experience claim '${claimedPhrase}'`,
        category: "RESPONSIBILITY",
        evidenceIds: [],
        factCheckStatus: "UNSUPPORTED",
        reason:
          tenureReason ||
          `Experience duration '${claimedPhrase}' is not evidenced by resume dates.`,
      });
    } else {
      claims.push({
        claim: `Experience claim '${claimedPhrase}'`,
        category: "RESPONSIBILITY",
        evidenceIds: [primaryEvidenceId],
        factCheckStatus: "SUPPORTED",
      });
    }
  }

  // 5.5. Employer / Company Protection
  if (change.field === "company" || change.field === "employer") {
    const origCompany = normalizeEvidenceTerm(originalText);
    const propCompany = normalizeEvidenceTerm(proposedText);
    if (
      origCompany !== propCompany &&
      !evidenceMap.employers.has(propCompany) &&
      !fullResumeRawText.includes(propCompany)
    ) {
      verifiedChange.status = "BLOCKED";
      verifiedChange.factCheckStatus = "CONTRADICTED";
      verifiedChange.blockedReason = `Employer modification detected: '${proposedText}' does not match candidate employer history.`;
      claims.push({
        claim: `Employer '${proposedText}'`,
        category: "EMPLOYER",
        evidenceIds: [primaryEvidenceId],
        factCheckStatus: "CONTRADICTED",
        reason: `Employer '${proposedText}' is not supported by candidate work history.`,
      });
    }
  }

  const PROMINENT_TECH_EMPLOYERS = [
    "google",
    "meta",
    "facebook",
    "amazon",
    "apple",
    "netflix",
    "microsoft",
    "uber",
    "airbnb",
  ];
  for (const emp of PROMINENT_TECH_EMPLOYERS) {
    if (
      isMentionedInText(emp, proposedText) &&
      !isMentionedInText(emp, originalText) &&
      !isMentionedInText(emp, fullResumeRawText)
    ) {
      verifiedChange.status = "BLOCKED";
      verifiedChange.factCheckStatus = "CONTRADICTED";
      verifiedChange.blockedReason = `Employer modification detected: Introduced unevidenced employer '${emp}'.`;
      claims.push({
        claim: `Employer claim '${emp}'`,
        category: "EMPLOYER",
        evidenceIds: [primaryEvidenceId],
        factCheckStatus: "CONTRADICTED",
        reason: `Employer '${emp}' is not found in candidate resume history.`,
      });
    }
  }

  // 6. Date / Duration Protection
  const yearRegex = /\b(19\d\d|20\d\d)\b/g;
  const origYears = (originalText.match(yearRegex) || []) as string[];
  const propYears = (proposedText.match(yearRegex) || []) as string[];
  if (propYears.length > 0) {
    const introducedYears = propYears.filter((y) => !origYears.includes(y));
    for (const year of introducedYears) {
      const isDateField =
        change.field === "startDate" ||
        change.field === "endDate" ||
        change.field === "dates";
      const isAllowed = isDateField
        ? origYears.includes(year)
        : fullResumeRawText.includes(year);
      if (!isAllowed) {
        verifiedChange.status = "BLOCKED";
        verifiedChange.factCheckStatus = "CONTRADICTED";
        verifiedChange.blockedReason =
          verifiedChange.blockedReason ||
          `Employment date modification detected: Introduced year '${year}' not matching original dates.`;
        claims.push({
          claim: `Employment year '${year}'`,
          category: "EMPLOYMENT_DATES",
          evidenceIds: [primaryEvidenceId],
          factCheckStatus: "CONTRADICTED",
          reason: `Date '${year}' is not evidenced in your resume.`,
        });
      }
    }
  }

  // If no specific technical claims were extracted, register the core rephrase statement
  if (claims.length === 0) {
    claims.push({
      claim: "Rephrases evidenced candidate background",
      category: "RESPONSIBILITY",
      evidenceIds: [primaryEvidenceId],
      factCheckStatus: "SUPPORTED",
    });
  }

  // 7. Calculate Deterministic Fact Guard Score (Prompt Section 18)
  const supportedClaimsCount = claims.filter(
    (c) => c.factCheckStatus === "SUPPORTED",
  ).length;
  const unsupportedClaimsCount = claims.filter(
    (c) =>
      c.factCheckStatus === "UNSUPPORTED" ||
      c.factCheckStatus === "CONTRADICTED",
  ).length;
  const uncertainClaimsCount = claims.filter(
    (c) => c.factCheckStatus === "UNCERTAIN",
  ).length;
  const hasContradicted = claims.some(
    (c) => c.factCheckStatus === "CONTRADICTED",
  );

  let factGuardScore = 100;
  if (unsupportedClaimsCount > 0 || uncertainClaimsCount > 0) {
    // Formula from prompt Section 18:
    // supported factual claims / total factual claims * 100
    // Example: 10 total claims, 8 supported, 1 unsupported, 1 uncertain -> Fact Guard = 80%
    // Never report 100% when unsupported or uncertain claims exist.
    const total = claims.length || 1;
    const rawScore = Math.round((supportedClaimsCount / total) * 100);
    factGuardScore = Math.min(99, rawScore);
    verifiedChange.status = "BLOCKED";
    if (hasContradicted) {
      verifiedChange.factCheckStatus = "CONTRADICTED";
    } else {
      verifiedChange.factCheckStatus = "UNSUPPORTED";
    }
  } else {
    factGuardScore = 100;
    if (verifiedChange.status !== "BLOCKED") {
      verifiedChange.status =
        change.status === "APPROVED" ? "APPROVED" : "PENDING";
      verifiedChange.factCheckStatus = "SUPPORTED";
      verifiedChange.factCheckReasoning =
        "All claims, technologies, and metrics are verified from candidate source evidence.";
    }
  }

  verifiedChange.extractedClaims = claims.map((c) => c.claim);

  return {
    verifiedChange,
    claims,
    factGuardScore,
    supportedClaimsCount,
    unsupportedClaimsCount,
  };
}

/**
 * Core Fact Guard verification engine for batch changes.
 * Audits every proposed change against original resume evidence and original values.
 */
export function verifyProposedChanges(
  changes: ResumeContentChange[],
  resumeData: ResumeData,
): VerificationResult {
  const verifiedChanges: ResumeContentChange[] = [];
  let verifiedCount = 0;
  let blockedCount = 0;
  let uncertainCount = 0;

  for (const change of changes) {
    const { verifiedChange, unsupportedClaimsCount } = verifySingleChange(
      change,
      resumeData,
    );

    if (verifiedChange.status === "BLOCKED" || unsupportedClaimsCount > 0) {
      blockedCount++;
    } else {
      verifiedCount++;
    }

    verifiedChanges.push(verifiedChange);
  }

  return {
    verifiedChanges,
    stats: {
      totalProposed: changes.length,
      verifiedCount,
      blockedCount,
      uncertainCount,
    },
  };
}
