import {
  ResumeData,
  JobAnalysis,
  MatchedSkillItem,
  RequirementImportanceEnum,
} from "@resumeai/shared";

// Canonical skill normalization dictionary
const SYNONYM_MAP: Record<string, string> = {
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  postgres: "PostgreSQL",
  postgresql: "PostgreSQL",
  psql: "PostgreSQL",
  node: "Node.js",
  nodejs: "Node.js",
  "node.js": "Node.js",
  react: "React",
  reactjs: "React",
  "react.js": "React",
  vue: "Vue.js",
  vuejs: "Vue.js",
  "vue.js": "Vue.js",
  angular: "Angular",
  angularjs: "Angular",
  k8s: "Kubernetes",
  kubernetes: "Kubernetes",
  golang: "Go",
  go: "Go",
  py: "Python",
  python: "Python",
  mongo: "MongoDB",
  mongodb: "MongoDB",
  gql: "GraphQL",
  graphql: "GraphQL",
  aws: "AWS",
  "amazon web services": "AWS",
  gcp: "GCP",
  "google cloud": "GCP",
  "google cloud platform": "GCP",
  azure: "Azure",
  "microsoft azure": "Azure",
  tf: "Terraform",
  terraform: "Terraform",
  docker: "Docker",
  "ci/cd": "CI/CD",
  cicd: "CI/CD",
  "recommendation systems": "Recommendation Systems",
  "recommendation system": "Recommendation Systems",
  "recommender systems": "Recommendation Systems",
  "recommender system": "Recommendation Systems",
  recommender: "Recommendation Systems",
  databricks: "Databricks",
  pyspark: "PySpark",
  spark: "Apache Spark",
  "apache spark": "Apache Spark",
  "scikit-learn": "Scikit-learn",
  "scikit learn": "Scikit-learn",
  sklearn: "Scikit-learn",
  tensorflow: "TensorFlow",
  pytorch: "PyTorch",
  xgboost: "XGBoost",
  ml: "Machine Learning",
  "machine learning": "Machine Learning",
  "feature engineering": "Feature Engineering",
  "deep learning": "Deep Learning",
  nlp: "NLP",
  rag: "RAG",
  microservices: "Microservices",
  microservice: "Microservices",
  "micro-services": "Microservices",
  "micro-service": "Microservices",
  forecasting: "Forecasting",
  "time-series": "Forecasting",
  "time-series modeling": "Forecasting",
  "time series": "Forecasting",
  optimization: "Optimization",
  "optimization techniques": "Optimization",
  clustering: "Clustering",
  regression: "Regression",
};

export function normalizeSkillName(raw: string): string {
  const clean = raw.trim().toLowerCase();
  return SYNONYM_MAP[clean] || raw.trim();
}

export interface ExtractedResumeEvidence {
  section: string;
  text: string;
}

/**
 * Collect all textual tokens and evidence snippets from resume data
 */
export function extractResumeTextTokens(resume: ResumeData): {
  skillsList: string[];
  normalizedSkillsSet: Set<string>;
  allEvidenceSnippets: ExtractedResumeEvidence[];
  fullTextLower: string;
} {
  const skillsList: string[] = [];
  const normalizedSkillsSet = new Set<string>();
  const allEvidenceSnippets: ExtractedResumeEvidence[] = [];
  const textParts: string[] = [];

  // 1. Skills section
  if (Array.isArray(resume.skills)) {
    for (const group of resume.skills) {
      if (Array.isArray(group.skills)) {
        for (const s of group.skills) {
          const trimmed = s.trim();
          if (trimmed) {
            skillsList.push(trimmed);
            normalizedSkillsSet.add(normalizeSkillName(trimmed).toLowerCase());
            normalizedSkillsSet.add(trimmed.toLowerCase());
            allEvidenceSnippets.push({
              section: "skills",
              text: `Listed under ${group.category || "Skills"}: ${trimmed}`,
            });
            textParts.push(trimmed);
          }
        }
      }
    }
  }

  // 2. Work experience
  if (Array.isArray(resume.experience)) {
    for (const exp of resume.experience) {
      const roleStr = [exp.position, exp.jobTitle, exp.company]
        .filter(Boolean)
        .join(" at ");
      if (roleStr) {
        textParts.push(roleStr);
        allEvidenceSnippets.push({
          section: "experience",
          text: roleStr,
        });
      }

      if (Array.isArray(exp.technologiesUsed)) {
        for (const tech of exp.technologiesUsed) {
          const trimmed = tech.trim();
          if (trimmed) {
            skillsList.push(trimmed);
            normalizedSkillsSet.add(normalizeSkillName(trimmed).toLowerCase());
            normalizedSkillsSet.add(trimmed.toLowerCase());
            allEvidenceSnippets.push({
              section: "experience",
              text: `Used ${trimmed} as ${roleStr || "employee"}`,
            });
            textParts.push(trimmed);
          }
        }
      }

      if (Array.isArray(exp.bullets)) {
        for (const bullet of exp.bullets) {
          if (bullet.trim()) {
            allEvidenceSnippets.push({
              section: "experience",
              text: bullet.trim(),
            });
            textParts.push(bullet.trim());
          }
        }
      }

      if (exp.description?.trim()) {
        allEvidenceSnippets.push({
          section: "experience",
          text: exp.description.trim(),
        });
        textParts.push(exp.description.trim());
      }
    }
  }

  // 3. Projects
  if (Array.isArray(resume.projects)) {
    for (const proj of resume.projects) {
      const projName = proj.name || (proj as any).title || "Project";
      textParts.push(projName);
      allEvidenceSnippets.push({
        section: "projects",
        text: `Project: ${projName}`,
      });

      if (Array.isArray(proj.technologies)) {
        for (const tech of proj.technologies) {
          const trimmed = tech.trim();
          if (trimmed) {
            skillsList.push(trimmed);
            normalizedSkillsSet.add(normalizeSkillName(trimmed).toLowerCase());
            normalizedSkillsSet.add(trimmed.toLowerCase());
            allEvidenceSnippets.push({
              section: "projects",
              text: `Used ${trimmed} in project "${projName}"`,
            });
            textParts.push(trimmed);
          }
        }
      }

      if (Array.isArray(proj.bullets)) {
        for (const b of proj.bullets) {
          if (b.trim()) {
            allEvidenceSnippets.push({
              section: "projects",
              text: b.trim(),
            });
            textParts.push(b.trim());
          }
        }
      }

      if (proj.description?.trim()) {
        allEvidenceSnippets.push({
          section: "projects",
          text: proj.description.trim(),
        });
        textParts.push(proj.description.trim());
      }
    }
  }

  // 4. Certifications
  if (Array.isArray(resume.certifications)) {
    for (const cert of resume.certifications) {
      if (cert.name?.trim()) {
        skillsList.push(cert.name.trim());
        allEvidenceSnippets.push({
          section: "certifications",
          text: `Certification: ${cert.name.trim()}`,
        });
        textParts.push(cert.name.trim());
      }
    }
  }

  // 5. Summary
  if (resume.summary?.trim()) {
    allEvidenceSnippets.push({
      section: "summary",
      text: resume.summary.trim(),
    });
    textParts.push(resume.summary.trim());
  }

  return {
    skillsList,
    normalizedSkillsSet,
    allEvidenceSnippets,
    fullTextLower: textParts.join(" ").toLowerCase(),
  };
}

/**
 * Strict regex boundary matcher that protects against false positives and enforces skill hierarchy:
 * - Java vs JavaScript (Java will NEVER match JavaScript)
 * - C vs C++ vs C#
 * - React vs React Native (React will not match if only React Native is present)
 * - AWS vs AWS Lambda (AWS will not match if only AWS Lambda is present)
 * - Python vs PySpark (Python will NEVER match PySpark)
 * - Python / SQL / Pandas vs Databricks (Databricks will NEVER match Python/SQL/Pandas)
 * - Docker vs Kubernetes
 * - Machine Learning vs Forecasting / Optimization / Clustering
 * - REST APIs / Node.js / Express vs Microservices
 * - Generic data processing vs Distributed data processing
 */
export function matchesSkillStrict(skillName: string, text: string): boolean {
  const s = skillName.trim().toLowerCase();
  const t = text.toLowerCase();

  // 1. Java vs JavaScript
  if (s === "java") {
    const javaRegex = /\bjava\b(?!script)/i;
    return javaRegex.test(t);
  }

  // 2. C vs C++ vs C#
  if (s === "c") {
    const cRegex = /(?:^|\s)c(?:\s|[.,;:]|$)/i;
    return cRegex.test(t) && !/\bc\+\+\b/i.test(t) && !/\bc#\b/i.test(t);
  }

  // 3. React vs React Native
  if (s === "react" || s === "react.js" || s === "reactjs") {
    const reactRegex = /\breact(?:\.js|js)?\b(?!\s*native)/i;
    return reactRegex.test(t);
  }

  // 4. AWS vs AWS Lambda
  if (s === "aws" || s === "amazon web services") {
    const awsRegex = /\baws\b(?!\s*lambda)/i;
    return awsRegex.test(t) || /\bamazon\s+web\s+services\b/i.test(t);
  }

  // 5. Databricks requires explicit databricks
  if (s === "databricks") {
    return /\bdatabricks\b/i.test(t);
  }

  // 6. PySpark / Apache Spark
  if (s === "pyspark" || s === "apache spark" || s === "spark") {
    return (
      /\b(?:py-?spark|apache\s*spark)\b/i.test(t) ||
      (s === "spark" && /\bspark\b(?!\s*plug)/i.test(t))
    );
  }

  // 7. Microservices: requires explicit microservice(s)
  if (
    s === "microservices" ||
    s === "microservice" ||
    s === "micro-services" ||
    s === "micro-service"
  ) {
    return /\bmicro-?services?\b/i.test(t);
  }

  // 8. Forecasting / Time-Series
  if (
    s === "forecasting" ||
    s === "time-series modeling" ||
    s === "time-series" ||
    s === "time series"
  ) {
    return /\b(?:forecast(?:ing|s)?|time[- ]series|arima|prophet|lstm\s+forecast)\b/i.test(
      t,
    );
  }

  // 9. Optimization
  if (s === "optimization" || s === "optimization techniques") {
    return /\b(?:optimization\s+techniques?|mathematical\s+optimization|linear\s+programming|convex\s+optimization|or-tools|simplex)\b/i.test(
      t,
    );
  }

  // 10. Clustering
  if (s === "clustering") {
    return /\b(?:clustering|k-means|dbscan|hierarchical\s+clustering|gaussian\s+mixture)\b/i.test(
      t,
    );
  }

  // 11. Regression
  if (s === "regression") {
    return /\b(?:regression|linear\s+regression|logistic\s+regression|ridge\s+regression|lasso\s+regression|polynomial\s+regression)\b/i.test(
      t,
    );
  }

  // 12. Recommendation Systems
  if (
    s === "recommendation systems" ||
    s === "recommendation system" ||
    s === "recommender systems" ||
    s === "recommender system"
  ) {
    return /\b(?:recommend(?:ation|er)?\s*systems?|content-based\s+recommendation|collaborative\s+filtering|recommender)\b/i.test(
      t,
    );
  }

  // 13. Distributed data processing
  if (s === "distributed data processing" || s === "distributed processing") {
    return (
      /\bdistributed\s+(?:data\s+)?processing\b/i.test(t) ||
      /\b(?:spark|hadoop|flink|ray|dask)\b/i.test(t)
    );
  }

  // 14. Kubernetes vs Docker
  if (s === "kubernetes" || s === "k8s") {
    return /\b(?:kubernetes|k8s)\b/i.test(t);
  }

  // 15. Feature Engineering
  if (s === "feature engineering") {
    return /\b(?:feature\s+engineering|data\s+preprocessing\s+and\s+feature\s+engineering)\b/i.test(
      t,
    );
  }

  // 16. Standard regex with word boundaries
  const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const generalRegex = new RegExp(`\\b${escaped}\\b`, "i");
  return generalRegex.test(t);
}

export interface SkillMatchResult {
  matchedSkills: MatchedSkillItem[];
  missingSkills: MatchedSkillItem[];
  partialSkills: MatchedSkillItem[];
  score: number; // 0 to 100
  matchedCount: number;
  totalCount: number;
  requiredScore: number;
  requiredMatchedCount: number;
  requiredTotalCount: number;
  preferredScore: number;
  preferredMatchedCount: number;
  preferredTotalCount: number;
}

export function matchSkills(
  jobAnalysis: JobAnalysis,
  resumeData: ResumeData,
): SkillMatchResult {
  const { normalizedSkillsSet, allEvidenceSnippets, fullTextLower } =
    extractResumeTextTokens(resumeData);

  const matchedSkills: MatchedSkillItem[] = [];
  const missingSkills: MatchedSkillItem[] = [];
  const partialSkills: MatchedSkillItem[] = [];

  const jobSkills = jobAnalysis.skills || [];

  if (jobSkills.length === 0) {
    return {
      matchedSkills: [],
      missingSkills: [],
      partialSkills: [],
      score: 100,
      matchedCount: 0,
      totalCount: 0,
      requiredScore: 100,
      requiredMatchedCount: 0,
      requiredTotalCount: 0,
      preferredScore: 100,
      preferredMatchedCount: 0,
      preferredTotalCount: 0,
    };
  }

  let requiredPointsPossible = 0;
  let requiredPointsEarned = 0;
  let requiredTotalCount = 0;
  let requiredMatchedCount = 0;

  let preferredPointsPossible = 0;
  let preferredPointsEarned = 0;
  let preferredTotalCount = 0;
  let preferredMatchedCount = 0;

  for (const jobSkill of jobSkills) {
    const rawName = jobSkill.name.trim();
    const canonicalName =
      jobSkill.normalizedName?.trim() || normalizeSkillName(rawName);
    const canonicalLower = canonicalName.toLowerCase();
    const rawLower = rawName.toLowerCase();

    const isRequired = jobSkill.importance === "REQUIRED";
    if (isRequired) {
      requiredTotalCount++;
      requiredPointsPossible += 1.0;
    } else {
      preferredTotalCount++;
      preferredPointsPossible += 1.0;
    }

    // Check if skill is explicitly declared as NOT required in the job
    const isNegatedInJob =
      /\b(?:not\s+required|no\b.*\brequired|not\s+needed|not\s+mandatory)\b/i.test(
        jobSkill.evidence || "",
      ) || /\b(?:not\s+required|no\b.*\brequired)\b/i.test(rawName);

    if (isNegatedInJob) {
      if (isRequired) {
        requiredPointsEarned += 1.0;
        requiredMatchedCount++;
      } else {
        preferredPointsEarned += 1.0;
        preferredMatchedCount++;
      }
      matchedSkills.push({
        skill: rawName,
        normalizedSkill: canonicalName,
        importance: "PREFERRED",
        matchType: "MATCHED",
        resumeEvidence: ["Explicit non-requirement in job description"],
        jobEvidence: jobSkill.evidence || undefined,
        confidence: 1.0,
      });
      continue;
    }

    // Check 1: Direct normalized skill list match
    const inSkillsList =
      normalizedSkillsSet.has(canonicalLower) ||
      normalizedSkillsSet.has(rawLower);

    // Check 2: Verbatim evidence match in bullets/descriptions/projects
    const matchingSnippets: string[] = [];
    for (const ev of allEvidenceSnippets) {
      if (
        matchesSkillStrict(canonicalName, ev.text) ||
        matchesSkillStrict(rawName, ev.text)
      ) {
        matchingSnippets.push(ev.text);
      }
    }

    if (inSkillsList || matchingSnippets.length > 0) {
      // Full Match
      if (isRequired) {
        requiredPointsEarned += 1.0;
        requiredMatchedCount++;
      } else {
        preferredPointsEarned += 1.0;
        preferredMatchedCount++;
      }
      matchedSkills.push({
        skill: rawName,
        normalizedSkill: canonicalName,
        importance: jobSkill.importance,
        matchType: "MATCHED",
        resumeEvidence:
          matchingSnippets.slice(0, 3).length > 0
            ? matchingSnippets.slice(0, 3)
            : [`Listed in resume skills: ${canonicalName}`],
        jobEvidence: jobSkill.evidence || undefined,
        confidence: inSkillsList && matchingSnippets.length > 0 ? 0.98 : 0.9,
      });
    } else {
      // Check for partial / related mention (ONLY for approved partials, NEVER disallowed hierarchy jumps)
      let partialEvidence: string | null = null;
      let partialReason: string | null = null;

      // Special handling for Regression: if candidate has ML prediction experience without explicit regression
      if (
        canonicalLower === "regression" &&
        (fullTextLower.includes("prediction") ||
          fullTextLower.includes("predictive") ||
          fullTextLower.includes("machine learning"))
      ) {
        partialEvidence =
          "Demonstrates predictive machine learning model development";
        partialReason =
          "Demonstrates machine learning prediction, but does not explicitly cite regression modeling methodology";
      }

      // Disallowed cross-category partials: Databricks, PySpark, Forecasting, Optimization, Clustering, Microservices
      // MUST NOT be inferred from Python, SQL, Pandas, Node.js, etc.
      const isDisallowedPartial =
        canonicalLower === "databricks" ||
        canonicalLower === "pyspark" ||
        canonicalLower === "apache spark" ||
        canonicalLower === "forecasting" ||
        canonicalLower === "optimization" ||
        canonicalLower === "clustering" ||
        canonicalLower === "microservices";

      if (!isDisallowedPartial && partialEvidence) {
        if (isRequired) {
          requiredPointsEarned += 0.5;
        } else {
          preferredPointsEarned += 0.5;
        }
        partialSkills.push({
          skill: rawName,
          normalizedSkill: canonicalName,
          importance: jobSkill.importance,
          matchType: "PARTIAL",
          resumeEvidence: [partialEvidence],
          jobEvidence: jobSkill.evidence || undefined,
          confidence: 0.6,
          reason:
            partialReason ||
            "Contextually mentioned without dedicated explicit qualification",
        });
      } else {
        // Missing (honest phrasing: "Not found in the resume")
        missingSkills.push({
          skill: rawName,
          normalizedSkill: canonicalName,
          importance: jobSkill.importance,
          matchType: "MISSING",
          resumeEvidence: [],
          jobEvidence: jobSkill.evidence || undefined,
          confidence: 1.0,
          reason: "Not found in the resume",
        });
      }
    }
  }

  const requiredScore =
    requiredPointsPossible > 0
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round((requiredPointsEarned / requiredPointsPossible) * 100),
          ),
        )
      : 100;

  const preferredScore =
    preferredPointsPossible > 0
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round((preferredPointsEarned / preferredPointsPossible) * 100),
          ),
        )
      : 100;

  // Combined score weighted: 40% required, 15% preferred (normalized to 100%)
  const totalPossible =
    requiredPointsPossible * 2.0 + preferredPointsPossible * 1.0;
  const totalEarned = requiredPointsEarned * 2.0 + preferredPointsEarned * 1.0;
  const score =
    totalPossible > 0
      ? Math.min(
          100,
          Math.max(0, Math.round((totalEarned / totalPossible) * 100)),
        )
      : 100;

  return {
    matchedSkills,
    missingSkills,
    partialSkills,
    score,
    matchedCount: matchedSkills.length,
    totalCount: jobSkills.length,
    requiredScore,
    requiredMatchedCount,
    requiredTotalCount,
    preferredScore,
    preferredMatchedCount,
    preferredTotalCount,
  };
}
