import { ResumeData } from "@resumeai/shared";

/**
 * Post-Parse Completeness Validator
 *
 * Compares the extracted source text against the resulting structured ResumeData
 * to detect any omitted sections, missing experience entries, dropped certifications,
 * or lost skills.
 *
 * Emits diagnostic warnings (e.g. PARSER_POSSIBLE_DATA_LOSS) without mutating data.
 */
export function validateParseCompleteness(
  sourceText: string,
  resumeData: ResumeData,
): string[] {
  const warnings: string[] = [];
  const textLower = sourceText.toLowerCase();

  // 1. Check for missing major sections
  const hasExpHeader =
    /(?:professional\s+experience|work\s+experience|employment\s+history|\bexperience\b)/i.test(
      sourceText,
    );
  if (
    hasExpHeader &&
    (!resumeData.experience || resumeData.experience.length === 0)
  ) {
    warnings.push(
      "PARSER_POSSIBLE_DATA_LOSS: Source document contains an Experience section, but no experience entries were parsed.",
    );
  }

  const hasEduHeader =
    /(?:academic\s+background|education|\bacademics\b)/i.test(sourceText);
  if (
    hasEduHeader &&
    (!resumeData.education || resumeData.education.length === 0)
  ) {
    warnings.push(
      "PARSER_POSSIBLE_DATA_LOSS: Source document contains an Education section, but no education entries were parsed.",
    );
  }

  const hasProjHeader =
    /(?:key\s+projects|personal\s+projects|academic\s+projects|\bprojects\b)/i.test(
      sourceText,
    );
  if (
    hasProjHeader &&
    (!resumeData.projects || resumeData.projects.length === 0)
  ) {
    warnings.push(
      "PARSER_POSSIBLE_DATA_LOSS: Source document contains a Projects section, but no project entries were parsed.",
    );
  }

  const hasCertHeader = /(?:certifications|certificates|licenses)/i.test(
    sourceText,
  );
  if (
    hasCertHeader &&
    (!resumeData.certifications || resumeData.certifications.length === 0)
  ) {
    warnings.push(
      "PARSER_POSSIBLE_DATA_LOSS: Source document contains a Certifications section, but no certification entries were parsed.",
    );
  }

  const hasLangHeader = /(?:languages|language\s+proficiency)/i.test(
    sourceText,
  );
  if (
    hasLangHeader &&
    (!resumeData.languages || resumeData.languages.length === 0)
  ) {
    warnings.push(
      "PARSER_POSSIBLE_DATA_LOSS: Source document contains a Languages section, but no language entries were parsed.",
    );
  }

  // 2. Check for missing skills explicitly listed in source
  // Gather all parsed skills into a single lookup set
  const parsedSkillNames = new Set<string>();
  for (const group of resumeData.skills || []) {
    for (const s of group.skills || []) {
      parsedSkillNames.add(s.toLowerCase());
    }
  }

  // Check prominent technologies if present in source text
  const COMMON_CHECK_SKILLS = [
    "python",
    "javascript",
    "typescript",
    "react",
    "node.js",
    "postgresql",
    "docker",
    "databricks",
    "pyspark",
    "aws",
    "kubernetes",
    "sql",
    "mongodb",
    "fastapi",
    "django",
  ];

  for (const skill of COMMON_CHECK_SKILLS) {
    const regex = new RegExp(`\\b${skill.replace(".", "\\.")}\\b`, "i");
    const inParsedSkills =
      parsedSkillNames.has(skill) ||
      Array.from(parsedSkillNames).some((ps) => regex.test(ps));

    if (regex.test(sourceText) && !inParsedSkills) {
      // Check if skill is in any bullet or description before flagging
      const inBullets = [
        ...(resumeData.experience || []).flatMap((e) => e.bullets || []),
        ...(resumeData.projects || []).flatMap((p) => p.bullets || []),
        ...(resumeData.projects || []).flatMap((p) => p.technologies || []),
      ].some((text) => regex.test(text));

      if (!inBullets) {
        warnings.push(
          `PARSER_POSSIBLE_DATA_LOSS: Key technology '${skill}' was detected in source document but not found in parsed skills or bullets.`,
        );
      }
    }
  }

  return warnings;
}
