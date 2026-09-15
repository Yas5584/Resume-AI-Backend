import {
  ATSValidationResult,
  ATSCheckItem,
  ChangeSection,
  FactualClaim,
  ATSCategoryScores,
} from "@resumeai/shared";

// Common strong action verbs for resume achievements
export const STRONG_ACTION_VERBS = new Set([
  "accelerated",
  "achieved",
  "administered",
  "advanced",
  "advised",
  "analyzed",
  "architected",
  "automated",
  "built",
  "centralized",
  "championed",
  "collaborated",
  "consolidated",
  "constructed",
  "coordinated",
  "created",
  "customized",
  "debugged",
  "delivered",
  "deployed",
  "designed",
  "developed",
  "devised",
  "directed",
  "documented",
  "drafted",
  "eliminated",
  "enabled",
  "enforced",
  "engineered",
  "enhanced",
  "established",
  "evaluated",
  "executed",
  "expanded",
  "expedited",
  "formulated",
  "generated",
  "guided",
  "implemented",
  "improved",
  "increased",
  "initiated",
  "innovated",
  "installed",
  "instituted",
  "integrated",
  "introduced",
  "launched",
  "lead",
  "led",
  "leveraged",
  "managed",
  "maximized",
  "mentored",
  "migrated",
  "minimized",
  "modernized",
  "monitored",
  "negotiated",
  "optimized",
  "orchestrated",
  "organized",
  "originated",
  "overhauled",
  "oversaw",
  "partnered",
  "performed",
  "pioneered",
  "planned",
  "prepared",
  "produced",
  "programmed",
  "published",
  "rearchitected",
  "rebuilt",
  "redesigned",
  "reduced",
  "refactored",
  "refined",
  "reformed",
  "remodeled",
  "reorganized",
  "replaced",
  "resolved",
  "restructured",
  "revamped",
  "reviewed",
  "revitalized",
  "saved",
  "scaled",
  "scheduled",
  "secured",
  "simplified",
  "spearheaded",
  "standardized",
  "steered",
  "streamlined",
  "strengthened",
  "structured",
  "supervised",
  "synthesized",
  "trained",
  "transformed",
  "transitioned",
  "translated",
  "unified",
  "upgraded",
  "validated",
  "verified",
]);

// Emoji and decorative unicode regex
const EMOJI_AND_DECORATIVE_REGEX =
  /[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1D400}-\u{1D7FF}]/u;

// Excessive punctuation regex (e.g. !!, ???, !!!)
const EXCESSIVE_PUNCTUATION_REGEX = /[!?]{2,}|\.{4,}/;

// Non-standard unicode control characters or hidden anomaly spaces
const UNICODE_CONTROL_REGEX =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/;

// First person pronouns to discourage in resumes
const FIRST_PERSON_PRONOUNS_REGEX = /\b(i|me|my|myself|we|us|our|ourselves)\b/i;

// Resume buzzwords/cliches
const FLUFF_BUZZWORDS_REGEX =
  /\b(go-getter|rockstar|ninja|guru|synergy|hard-working|detail-oriented team player)\b/i;

export interface ATSValidationOptions {
  claims?: FactualClaim[];
  unsupportedClaimsCount?: number;
  originalText?: string;
  hasContradictions?: boolean;
}

/**
 * Splits sentences accurately while protecting technical tokens like Node.js, Express.js,
 * decimals (e.g. 4.5), and abbreviations from creating false sentence boundaries.
 */
export function splitSentences(text: string): string[] {
  const protectedText = text
    .replace(/\b([A-Za-z0-9]+)\.js\b/gi, "$1_JSTOKEN_")
    .replace(/\b(\d+)\.(\d+)\b/g, "$1_DECIMAL_$2")
    .replace(/\b(e\.g\.|i\.e\.|etc\.)/gi, (m) => m.replace(/\./g, "_DOT_"));

  return protectedText
    .split(/[.!?]+/)
    .map((s) =>
      s
        .replace(/_JSTOKEN_/g, ".js")
        .replace(/_DECIMAL_/g, ".")
        .replace(/_DOT_/g, ".")
        .trim(),
    )
    .filter((s) => s.length > 0);
}

/**
 * Validates text for ATS-friendliness according to industry parsing standards.
 * Implements 14 deterministic backend checks with categorical scoring and penalties.
 */
export function validateATS(
  text: string,
  section: ChangeSection,
  options?: ATSValidationOptions,
): ATSValidationResult {
  const checks: ATSCheckItem[] = [];
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  let formattingScore = 15;
  let readabilityScore = 15;
  let keywordScore = 20;
  let structureScore = 15;
  let evidenceScore = 25;
  let penalties = 0;

  // 1. Standard Characters (No Emojis) (5 pts)
  const hasEmojis = EMOJI_AND_DECORATIVE_REGEX.test(trimmed);
  checks.push({
    name: "Standard Characters (No Emojis)",
    passed: !hasEmojis,
    feedback: hasEmojis
      ? "Contains decorative emojis or symbols that can corrupt ATS parsing."
      : undefined,
  });
  if (hasEmojis) formattingScore -= 5;

  // 2. Professional Punctuation (5 pts)
  const hasExcessivePunctuation = EXCESSIVE_PUNCTUATION_REGEX.test(trimmed);
  checks.push({
    name: "Professional Punctuation",
    passed: !hasExcessivePunctuation,
    feedback: hasExcessivePunctuation
      ? "Avoid repeated punctuation marks (e.g. '!!', '???') for professional ATS formatting."
      : undefined,
  });
  if (hasExcessivePunctuation) formattingScore -= 5;

  // 3. Unicode Anomalies & Control Characters (5 pts)
  const hasControlChars = UNICODE_CONTROL_REGEX.test(trimmed);
  checks.push({
    name: "Clean Unicode Encoding",
    passed: !hasControlChars,
    feedback: hasControlChars
      ? "Contains hidden control characters or non-standard Unicode anomalies."
      : undefined,
  });
  if (hasControlChars) formattingScore -= 5;

  // 4. Readability & Sentence Complexity (8 pts)
  const sentences = splitSentences(trimmed);
  const avgSentenceLength =
    sentences.length > 0 ? wordCount / sentences.length : wordCount;
  const isTooComplex = avgSentenceLength > 38 && wordCount > 40;
  checks.push({
    name: "Readability & Sentence Flow",
    passed: !isTooComplex,
    feedback: isTooComplex
      ? `Average sentence length (${Math.round(avgSentenceLength)} words) is overly complex. Break into punchier phrasing.`
      : undefined,
  });
  if (isTooComplex) readabilityScore -= 8;

  // 5. Professional Tone & Language (7 pts)
  const isExperienceOrProjects =
    section === "experience" ||
    section === "projects" ||
    section === "achievements";
  const hasFirstPerson =
    isExperienceOrProjects && FIRST_PERSON_PRONOUNS_REGEX.test(trimmed);
  const hasFluff = FLUFF_BUZZWORDS_REGEX.test(trimmed);
  const tonePassed = !hasFirstPerson && !hasFluff;
  checks.push({
    name: "Professional Tone (No Fluff)",
    passed: tonePassed,
    feedback: hasFirstPerson
      ? "Avoid first-person pronouns ('I', 'me', 'my') in bullet points."
      : hasFluff
        ? "Contains generic buzzwords/cliches. Focus on concrete technical accomplishments."
        : undefined,
  });
  if (!tonePassed) readabilityScore -= 7;

  // 6. Natural Keyword Density & Stuffing Detection (12 pts)
  const lowerWords = words
    .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length > 3);
  const frequencyMap = new Map<string, number>();
  for (const w of lowerWords) {
    frequencyMap.set(w, (frequencyMap.get(w) || 0) + 1);
  }
  let maxRepetition = 0;
  let stuffedWord = "";
  for (const [w, count] of frequencyMap.entries()) {
    if (count > maxRepetition) {
      maxRepetition = count;
      stuffedWord = w;
    }
  }

  const isKeywordStuffed =
    wordCount >= 10 &&
    maxRepetition > Math.max(3, Math.floor(wordCount * 0.25));
  checks.push({
    name: "Natural Keyword Density",
    passed: !isKeywordStuffed,
    feedback: isKeywordStuffed
      ? `Keyword '${stuffedWord}' appears ${maxRepetition} times in a short passage. Avoid keyword stuffing.`
      : undefined,
  });
  if (isKeywordStuffed) {
    keywordScore -= 12;
    penalties += 10; // -10 pts penalty for keyword stuffing
  }

  // 7. Non-Repetitive Phrasing (8 pts)
  const hasDuplicateConsecutive = /\b([a-z]{3,})\s+\1\b/i.test(trimmed);
  checks.push({
    name: "Non-Repetitive Phrasing",
    passed: !hasDuplicateConsecutive,
    feedback: hasDuplicateConsecutive
      ? "Contains accidental duplicate consecutive words."
      : undefined,
  });
  if (hasDuplicateConsecutive) keywordScore -= 8;

  // 8. Section-Specific Length Validation (8 pts)
  let lengthPassed = true;
  let lengthFeedback: string | undefined;

  if (section === "summary") {
    const sentenceCount = sentences.length;
    const isGoodSentenceCount = sentenceCount >= 2 && sentenceCount <= 4;
    const isGoodWordCount = wordCount >= 30 && wordCount <= 100;
    const isExcessive = wordCount > 120 || sentenceCount > 5;

    lengthPassed = isGoodSentenceCount && isGoodWordCount && !isExcessive;
    if (!lengthPassed) {
      lengthFeedback = isExcessive
        ? `Word count is ${wordCount} words (30-100 words recommended; maximum 120 words). Summary is excessively long.`
        : !isGoodSentenceCount
          ? `Contains ${sentenceCount} sentences (2-4 sentences recommended for high ATS impact).`
          : `Word count is ${wordCount} words (30-100 words recommended).`;
    }
  } else if (section === "experience" || section === "projects") {
    lengthPassed = wordCount >= 8 && wordCount <= 45;
    if (!lengthPassed) {
      lengthFeedback =
        wordCount < 8
          ? `Bullet is too short (${wordCount} words). Add task and technology details (10-40 words recommended).`
          : `Bullet is lengthy (${wordCount} words). Split into concise, focused achievements (10-40 words recommended).`;
    }
  } else if (section === "achievements") {
    lengthPassed = wordCount >= 6 && wordCount <= 45;
    if (!lengthPassed) {
      lengthFeedback = `Achievement is ${wordCount} words (10-40 words recommended).`;
    }
  }

  checks.push({
    name:
      section === "summary"
        ? "Summary Length (2-4 Sentences, 30-100 Words)"
        : "Concise Bullet Length (10-40 Words)",
    passed: lengthPassed,
    feedback: lengthFeedback,
  });
  if (!lengthPassed) structureScore -= 8;

  // 9. Starts with Strong Action Verb (4 pts)
  let actionVerbPassed = true;
  if (section === "experience" || section === "projects") {
    const firstWord = words[0]?.toLowerCase().replace(/[^a-z]/g, "");
    actionVerbPassed = Boolean(firstWord && STRONG_ACTION_VERBS.has(firstWord));
    checks.push({
      name: "Starts with Strong Action Verb",
      passed: actionVerbPassed,
      feedback: !actionVerbPassed
        ? `Begins with '${words[0] || ""}'. Leading with a past-tense action verb (e.g. 'Developed', 'Spearheaded') increases ATS scoring.`
        : undefined,
    });
    if (!actionVerbPassed) structureScore -= 4;
  } else {
    // For other sections (e.g. summary), this check is naturally satisfied
    checks.push({
      name: "Standard Section Positioning",
      passed: true,
    });
  }

  // 10. Clean Structural Formatting (3 pts)
  const hasFormattingIssue =
    trimmed.includes("\n\n\n") || trimmed.includes("   ");
  checks.push({
    name: "Clean Layout & Spacing",
    passed: !hasFormattingIssue,
    feedback: hasFormattingIssue
      ? "Contains irregular consecutive spacing or extra line returns."
      : undefined,
  });
  if (hasFormattingIssue) structureScore -= 3;

  // 11. Evidence Coverage Check (15 pts)
  const unsupportedCount = options?.unsupportedClaimsCount ?? 0;
  const evidenceCoveragePassed = unsupportedCount === 0;
  checks.push({
    name: "Candidate Evidence Coverage",
    passed: evidenceCoveragePassed,
    feedback: !evidenceCoveragePassed
      ? `${unsupportedCount} unverified claim(s) detected. Content must stay within verified candidate resume evidence.`
      : undefined,
  });
  if (!evidenceCoveragePassed) {
    evidenceScore -= 15;
  }

  // 12. Fact Contradiction Prevention (10 pts)
  const hasContradictions =
    options?.hasContradictions ||
    (options?.claims &&
      options.claims.some((c) => c.factCheckStatus === "CONTRADICTED"));
  checks.push({
    name: "Fact Contradiction Prevention",
    passed: !hasContradictions,
    feedback: hasContradictions
      ? "Contradicted claim detected: conflicts directly with authoritative candidate source facts."
      : undefined,
  });
  if (hasContradictions) {
    evidenceScore -= 10;
  }

  // 13. Unsupported Claims Penalty (-20 pts per unsupported claim)
  if (unsupportedCount > 0) {
    penalties += unsupportedCount * 20;
  }

  // Calculate deterministic score
  const baseScore =
    Math.max(0, formattingScore) +
    Math.max(0, readabilityScore) +
    Math.max(0, keywordScore) +
    Math.max(0, structureScore) +
    Math.max(0, evidenceScore);

  const finalScore = Math.max(
    0,
    Math.min(100, Math.round(baseScore - penalties)),
  );

  // ATS friendliness requires score >= 75, no emojis, zero unsupported claims, no contradictions, and valid length
  const isAtsFriendly =
    finalScore >= 75 &&
    !hasEmojis &&
    unsupportedCount === 0 &&
    !hasContradictions &&
    lengthPassed;

  let summary = "";
  if (unsupportedCount > 0) {
    summary = `ATS score penalized: ${unsupportedCount} unsupported claim(s) detected. All claims must be grounded in candidate evidence.`;
  } else if (hasContradictions) {
    summary =
      "ATS score penalized: Contradicted facts detected against candidate background.";
  } else if (isKeywordStuffed) {
    summary = "ATS score penalized: Excessive keyword repetition detected.";
  } else if (!isAtsFriendly) {
    summary =
      "Adjust phrasing to resolve ATS formatting, verb, or length warnings.";
  } else {
    summary =
      "ATS-friendly formatting with standard syntax, strong action verbs, and natural keyword alignment.";
  }

  const categoryScores: ATSCategoryScores = {
    formatting: Math.max(0, Math.min(15, formattingScore)),
    readability: Math.max(0, Math.min(15, readabilityScore)),
    keyword: Math.max(0, Math.min(20, keywordScore)),
    structure: Math.max(0, Math.min(15, structureScore)),
    evidence: Math.max(0, Math.min(25, evidenceScore)),
  };

  return {
    isAtsFriendly,
    score: finalScore,
    checks,
    summary,
    categoryScores,
  };
}
