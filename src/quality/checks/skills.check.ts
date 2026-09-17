import {
  ResumeData,
  SkillCategory,
  ResumeQualityFinding,
  ResumeQualityCategory,
  FindingSeverity,
  TechnologySource,
} from "@resumeai/shared";
import { DeterministicCheckResult } from "../types.js";

interface TechEvidence {
  original: string;
  sources: Set<TechnologySource>;
  projects: string[];
  roles: string[];
}

/**
 * Analyzes skills categorization, duplicate skill tags, capitalization consistency,
 * tracks technology sources (SKILLS, PROJECT, EXPERIENCE, CERTIFICATION),
 * and flags project-only or experience-only technologies with conditional Fact Guard recommendations.
 */
export function checkSkills(data: ResumeData): DeterministicCheckResult {
  const findings: ResumeQualityFinding[] = [];
  const skillGroups: SkillCategory[] = data.skills || [];

  let passed = 0;
  let total = 0;

  // 1. Presence of Skills
  total++;
  if (skillGroups.length === 0) {
    return {
      category: ResumeQualityCategory.SKILLS_KEYWORDS,
      findings: [
        {
          id: "skills-none",
          category: ResumeQualityCategory.SKILLS_KEYWORDS,
          severity: FindingSeverity.CRITICAL,
          title: "No skills listed",
          description: "Your resume does not include an organized Skills section.",
          whyItMatters:
            "ATS keyword matching relies directly on skills matching to rank candidates for job requisitions.",
          recommendation:
            "Add a Skills section grouping your technical languages, frameworks, cloud tools, and databases.",
          section: "skills",
        },
      ],
      passedChecksCount: 0,
      totalChecksCount: 5,
      metrics: { totalSkillsCount: 0, technologySources: {} },
    };
  }
  passed++;

  // Collect all skills
  const allSkills: { original: string; normalized: string; category: string }[] = [];
  const emptyCategories: string[] = [];

  // Technology Evidence & Source Tracking
  const techMap = new Map<string, TechEvidence>();

  const recordTech = (
    name: string,
    source: TechnologySource,
    context?: { projectTitle?: string; jobRole?: string },
  ) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const normalized = trimmed.toLowerCase();

    if (!techMap.has(normalized)) {
      techMap.set(normalized, {
        original: trimmed,
        sources: new Set<TechnologySource>([source]),
        projects: context?.projectTitle ? [context.projectTitle] : [],
        roles: context?.jobRole ? [context.jobRole] : [],
      });
    } else {
      const entry = techMap.get(normalized)!;
      entry.sources.add(source);
      if (context?.projectTitle && !entry.projects.includes(context.projectTitle)) {
        entry.projects.push(context.projectTitle);
      }
      if (context?.jobRole && !entry.roles.includes(context.jobRole)) {
        entry.roles.push(context.jobRole);
      }
    }
  };

  // 1. Ingest Skills Section
  skillGroups.forEach((group) => {
    const groupSkills = group.skills || [];
    if (groupSkills.length === 0) {
      emptyCategories.push(group.category || "Untitled Category");
    }
    groupSkills.forEach((skill) => {
      const trimmed = skill.trim();
      if (trimmed) {
        allSkills.push({
          original: trimmed,
          normalized: trimmed.toLowerCase(),
          category: group.category || "General",
        });
        recordTech(trimmed, "SKILLS");
      }
    });
  });

  // 2. Ingest Experience Technologies
  (data.experience || []).forEach((exp) => {
    const role = exp.jobTitle || exp.company || "Experience";
    (exp.technologiesUsed || []).forEach((tech) => {
      recordTech(tech, "EXPERIENCE", { jobRole: role });
    });
  });

  // 3. Ingest Projects Technologies
  (data.projects || []).forEach((proj) => {
    const pTitle = (proj as any).title || proj.name || "Project";
    (proj.technologies || []).forEach((tech) => {
      recordTech(tech, "PROJECT", { projectTitle: pTitle });
    });
  });

  // 4. Ingest Certifications
  (data.certifications || []).forEach((cert) => {
    if (cert.name && cert.name.trim()) {
      recordTech(cert.name, "CERTIFICATION");
    }
  });

  // 2. Empty Categories Check
  total++;
  if (emptyCategories.length === 0) {
    passed++;
  } else {
    findings.push({
      id: "skills-empty-category",
      category: ResumeQualityCategory.SKILLS_KEYWORDS,
      severity: FindingSeverity.LOW,
      title: `Empty skill category: ${emptyCategories.join(", ")}`,
      description: `Category "${emptyCategories.join(", ")}" contains no skills.`,
      whyItMatters: "Empty categories clutter the document and signal unfinished drafting.",
      recommendation: "Add relevant skills to this category or remove it.",
      section: "skills",
    });
  }

  // 3. Duplicate Skills Detection
  total++;
  const seenSkills = new Map<string, string>();
  const duplicateSkills = new Set<string>();
  const caseInconsistencies = new Set<string>();

  allSkills.forEach(({ original, normalized }) => {
    if (seenSkills.has(normalized)) {
      const prevOriginal = seenSkills.get(normalized)!;
      if (prevOriginal !== original) {
        caseInconsistencies.add(`"${prevOriginal}" vs "${original}"`);
      } else {
        duplicateSkills.add(original);
      }
    } else {
      seenSkills.set(normalized, original);
    }
  });

  if (duplicateSkills.size === 0) {
    passed++;
  } else {
    findings.push({
      id: "skills-duplicate-tags",
      category: ResumeQualityCategory.SKILLS_KEYWORDS,
      severity: FindingSeverity.LOW,
      title: `Duplicate skills listed (${Array.from(duplicateSkills).slice(0, 3).join(", ")})`,
      description: `The following skill tags appear multiple times: ${Array.from(duplicateSkills).join(", ")}.`,
      whyItMatters: "Repeated skills waste precious resume space without adding ATS value.",
      recommendation: "Remove duplicate entries so each technology is listed once.",
      section: "skills",
    });
  }

  // 4. Inconsistent Capitalization Detection
  total++;
  if (caseInconsistencies.size === 0) {
    passed++;
  } else {
    findings.push({
      id: "skills-case-inconsistency",
      category: ResumeQualityCategory.SKILLS_KEYWORDS,
      severity: FindingSeverity.LOW,
      title: "Inconsistent skill capitalization",
      description: `Inconsistent casing found: ${Array.from(caseInconsistencies).join(", ")}.`,
      whyItMatters: "Standardized industry casing (e.g. React, PostgreSQL, Node.js) shows professional attention to detail.",
      recommendation: "Use standard industry capitalization for each technology name.",
      section: "skills",
    });
  }

  // 5. Source Evidence Tracking & Project-Only / Experience-Only Technologies
  total++;
  const projectOnlyTechs: { name: string; project: string }[] = [];
  const expOnlyTechs: { name: string; role: string }[] = [];

  for (const [, entry] of techMap) {
    const inSkills = entry.sources.has("SKILLS");
    const inProjects = entry.sources.has("PROJECT");
    const inExp = entry.sources.has("EXPERIENCE");

    if (!inSkills) {
      if (inProjects && !inExp) {
        projectOnlyTechs.push({
          name: entry.original,
          project: entry.projects[0] || "Projects",
        });
      } else if (inExp) {
        expOnlyTechs.push({
          name: entry.original,
          role: entry.roles[0] || "Experience",
        });
      }
    }
  }

  // Requirement 3: Technology appears in project experience but is not listed in Skills.
  // Severity: INFO. Do NOT automatically recommend adding it. Do NOT state or imply user is proficient.
  if (projectOnlyTechs.length > 0) {
    projectOnlyTechs.forEach(({ name, project }) => {
      findings.push({
        id: `skills-tech-project-only-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        category: ResumeQualityCategory.SKILLS_KEYWORDS,
        severity: FindingSeverity.INFO,
        source: "PROJECT",
        title: "Technology appears in project experience but is not listed in Skills.",
        description: `"${name}" appears in project "${project}" but is absent from your Skills section.`,
        whyItMatters:
          "Recruiters filtering specifically by designated skills categories may not see tools mentioned solely in project descriptions.",
        recommendation:
          "If this represents a current skill you want recruiters to consider, consider adding it to Skills.",
        section: "skills",
        evidence: `Project: ${project} (${name})`,
      });
    });
  }

  if (expOnlyTechs.length > 0) {
    expOnlyTechs.forEach(({ name, role }) => {
      findings.push({
        id: `skills-tech-exp-only-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        category: ResumeQualityCategory.SKILLS_KEYWORDS,
        severity: FindingSeverity.INFO,
        source: "EXPERIENCE",
        title: "Technology appears in work experience but is not listed in Skills.",
        description: `"${name}" appears in work history ("${role}") but is absent from your Skills section.`,
        whyItMatters:
          "Highlighting proven technologies in both work experience and skills maximizes ATS keyword relevance.",
        recommendation:
          "If this represents a current skill you want recruiters to consider, consider adding it to Skills.",
        section: "skills",
        evidence: `Role: ${role} (${name})`,
      });
    });
  }

  if (projectOnlyTechs.length === 0 && expOnlyTechs.length === 0) {
    passed++;
  } else {
    // INFO findings do not fail checks or penalize scores
    passed++;
  }

  // Export technology sources formatted for metrics
  const technologySources: Record<string, { original: string; sources: TechnologySource[]; projects?: string[] }> = {};
  for (const [k, v] of techMap) {
    technologySources[k] = {
      original: v.original,
      sources: Array.from(v.sources),
      projects: v.projects.length > 0 ? v.projects : undefined,
    };
  }

  return {
    category: ResumeQualityCategory.SKILLS_KEYWORDS,
    findings,
    passedChecksCount: passed,
    totalChecksCount: total,
    metrics: {
      totalSkillsCount: allSkills.length,
      categoriesCount: skillGroups.length,
      duplicateCount: duplicateSkills.size,
      caseInconsistenciesCount: caseInconsistencies.size,
      projectOnlyTechsCount: projectOnlyTechs.length,
      expOnlyTechsCount: expOnlyTechs.length,
      technologySources,
    },
  };
}
